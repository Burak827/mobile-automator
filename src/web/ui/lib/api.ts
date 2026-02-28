export function formatOutput(payload: unknown): string {
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

export async function api<TResponse = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<TResponse> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const errorPayload =
      typeof payload === "object" && payload !== null
        ? (payload as { error?: unknown })
        : undefined;
    const message =
      typeof errorPayload?.error === "string"
        ? errorPayload.error
        : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload as TResponse;
}
