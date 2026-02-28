import { readFile } from "fs/promises";
import { SignJWT, importPKCS8 } from "jose";

export type GpcAuthConfig = {
  serviceAccountKeyPath: string;
};

type ServiceAccountKey = {
  type: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

export class GpcClient {
  private accessToken?: string;
  private tokenExpiry?: number;
  private serviceAccountKey?: ServiceAccountKey;

  constructor(private config: GpcAuthConfig) {}

  private async getServiceAccountKey(): Promise<ServiceAccountKey> {
    if (this.serviceAccountKey) return this.serviceAccountKey;
    const raw = await readFile(this.config.serviceAccountKeyPath, "utf8");
    this.serviceAccountKey = JSON.parse(raw) as ServiceAccountKey;
    return this.serviceAccountKey;
  }

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.accessToken && this.tokenExpiry && now < this.tokenExpiry - 60) {
      return this.accessToken;
    }

    const sa = await this.getServiceAccountKey();
    const key = await importPKCS8(sa.private_key, "RS256");

    const tokenUri = sa.token_uri ?? "https://oauth2.googleapis.com/token";
    const exp = now + 3600;
    const jwt = await new SignJWT({
      scope: "https://www.googleapis.com/auth/androidpublisher",
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(sa.client_email)
      .setSubject(sa.client_email)
      .setAudience(tokenUri)
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(key);

    const response = await fetch(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `Google OAuth token request failed (${response.status}): ${text}`
      );
    }

    const data = JSON.parse(text);
    this.accessToken = data.access_token;
    this.tokenExpiry = now + (data.expires_in ?? 3600);
    return this.accessToken!;
  }

  private static readonly BASE_URL =
    "https://androidpublisher.googleapis.com";

  async request<T>(
    method: string,
    path: string,
    options: { body?: unknown } = {}
  ): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${GpcClient.BASE_URL}${path}`;

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
      let message = `Google Play API request failed (${response.status} ${response.statusText})`;
      if (text) {
        try {
          const payload = JSON.parse(text);
          const detail = payload?.error?.message ?? text;
          message = `${message}: ${detail}`;
        } catch {
          message = `${message}: ${text}`;
        }
      }
      throw new Error(message);
    }

    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, { body });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, { body: body ?? {} });
  }

  delete(path: string): Promise<void> {
    return this.request<void>("DELETE", path);
  }

  async createEdit(packageName: string): Promise<string> {
    const result = await this.post<{ id?: string }>(
      `/androidpublisher/v3/applications/${packageName}/edits`,
      {}
    );
    if (!result.id) throw new Error("Failed to create edit: no id returned");
    return result.id;
  }

  async commitEdit(packageName: string, editId: string): Promise<void> {
    await this.post(
      `/androidpublisher/v3/applications/${packageName}/edits/${editId}:commit`
    );
  }

  async deleteEdit(packageName: string, editId: string): Promise<void> {
    await this.delete(
      `/androidpublisher/v3/applications/${packageName}/edits/${editId}`
    );
  }
}
