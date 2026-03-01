import { readFile } from "fs/promises";
import { SignJWT, importPKCS8 } from "jose";

export type AscAuthConfig = {
  issuerId: string;
  keyId: string;
  privateKeyPath: string;
  baseUrl?: string;
};

export type QueryValue = string | number | boolean | Array<string | number> | undefined;

function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      params.set(key, value.join(","));
      continue;
    }
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export class AscClient {
  private tokenValue?: string;
  private tokenExpiry?: number;

  constructor(private config: AscAuthConfig) {}

  private async getToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.tokenValue && this.tokenExpiry && now < this.tokenExpiry - 60) {
      return this.tokenValue;
    }

    const privateKey = await readFile(this.config.privateKeyPath, "utf8");
    const key = await importPKCS8(privateKey, "ES256");

    const exp = now + 20 * 60;
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: this.config.keyId, typ: "JWT" })
      .setIssuer(this.config.issuerId)
      .setAudience("appstoreconnect-v1")
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(key);

    this.tokenValue = token;
    this.tokenExpiry = exp;
    return token;
  }

  private get baseUrl(): string {
    return this.config.baseUrl ?? "https://api.appstoreconnect.apple.com";
  }

  async request<T>(
    method: string,
    path: string,
    options: { query?: Record<string, QueryValue>; body?: unknown } = {}
  ): Promise<T> {
    const token = await this.getToken();
    const url = `${this.baseUrl}${path}${buildQuery(options.query)}`;

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    if (!response.ok) {
      let message = `ASC request failed (${response.status} ${response.statusText})`;
      if (text) {
        try {
          const payload = JSON.parse(text);
          const errors = payload?.errors;
          if (Array.isArray(errors) && errors.length > 0) {
            const details = errors
              .map((err: { status?: string; title?: string; detail?: string }) =>
                [err.status, err.title, err.detail].filter(Boolean).join(" - ")
              )
              .join(" | ");
            message = `${message}: ${details}`;
          } else {
            message = `${message}: ${text}`;
          }
        } catch {
          message = `${message}: ${text}`;
        }
      }
      throw new Error(message);
    }

    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  get<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
    return this.request<T>("GET", path, { query });
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, { body });
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, { body });
  }

  delete(path: string): Promise<void> {
    return this.request<void>("DELETE", path);
  }
}
