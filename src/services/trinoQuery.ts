/**
 * Trino REST API client for querying Strategy Mosaic.
 *
 * Protocol: POST /v1/statement with raw SQL body.
 * Pagination: follow `nextUri` until no more pages.
 * Auth: Bearer token from localStorage.
 *
 * In dev: Vite proxy rewrites /api/sql → studio.strategy.com/sql
 * In prod: nginx/cloudflare proxy does the same.
 */

const TOKEN_KEY = "mosaic_token";
const SQL_ENDPOINT = "/api/sql";

/** Events for auth state changes */
type AuthListener = (needsAuth: boolean, message?: string) => void;
const authListeners: AuthListener[] = [];

export function onAuthNeeded(listener: AuthListener): () => void {
  authListeners.push(listener);
  return () => {
    const idx = authListeners.indexOf(listener);
    if (idx >= 0) authListeners.splice(idx, 1);
  };
}

function notifyAuthNeeded(message?: string) {
  authListeners.forEach((l) => l(true, message));
}

/** Token management */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function hasToken(): boolean {
  return !!getToken();
}

/** Trino response types */
interface TrinoResponse {
  id?: string;
  columns?: Array<{ name: string; type: string }>;
  data?: unknown[][];
  nextUri?: string;
  error?: { message: string; errorCode: number; errorName: string };
  stats?: { state: string };
}

/**
 * Execute a SQL query against Mosaic via Trino REST API.
 * Returns all result rows (handles pagination automatically).
 */
export async function executeQuery(sql: string): Promise<unknown[][]> {
  const token = getToken();
  if (!token) {
    notifyAuthNeeded("No token configured. Please enter your Mosaic access token.");
    throw new Error("No auth token");
  }

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "X-Trino-User": "mosaic-viz",
    "X-Trino-Schema": "shared studio",
    "Content-Type": "text/plain",
  };

  // Initial POST with SQL
  const initRes = await fetch(SQL_ENDPOINT, {
    method: "POST",
    headers,
    body: sql,
  });

  if (initRes.status === 401 || initRes.status === 403) {
    notifyAuthNeeded("Token expired or invalid. Please update your Mosaic access token.");
    throw new Error("Auth failed");
  }

  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`Trino query failed (${initRes.status}): ${text}`);
  }

  let response: TrinoResponse = await initRes.json();
  const allRows: unknown[][] = [];

  // Collect data from first response
  if (response.data) {
    allRows.push(...response.data);
  }

  if (response.error) {
    throw new Error(`Trino error: ${response.error.message}`);
  }

  // Follow pagination
  while (response.nextUri) {
    // Small delay to avoid hammering
    await new Promise((r) => setTimeout(r, 50));

    const pageRes = await fetch(response.nextUri, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` },
    });

    if (!pageRes.ok) {
      // 503 = query not ready, retry
      if (pageRes.status === 503) {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      break;
    }

    response = await pageRes.json();

    if (response.data) {
      allRows.push(...response.data);
    }

    if (response.error) {
      throw new Error(`Trino error: ${response.error.message}`);
    }
  }

  return allRows;
}
