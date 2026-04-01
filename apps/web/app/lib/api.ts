export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? API_URL;

export type ApiOptions = RequestInit & {
  token?: string | null;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}) {
  const headers = new Headers(options.headers ?? {});
  headers.set("Content-Type", "application/json");

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      cache: "no-store"
    });

    if (!response.ok) {
      const body = await response.text();

      try {
        const parsed = JSON.parse(body) as { message?: string; error?: string; code?: string };
        const message = parsed.message ?? parsed.error ?? body ?? `Request failed with ${response.status}`;
        throw new Error(message);
      } catch {
        throw new Error(body || `Request failed with ${response.status}`);
      }
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`FixCapital could not reach the API at ${API_URL}. Make sure the API is running and that local dev CORS allows this web origin.`);
    }

    throw error;
  }
}
