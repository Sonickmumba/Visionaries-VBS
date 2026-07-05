export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
let csrfToken = null;

async function fetchCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch(`${API_URL}/auth/csrf`, { credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.csrfToken) throw new Error(data.error || "Unable to prepare secure request");
  csrfToken = data.csrfToken;
  return csrfToken;
}

export async function api(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (UNSAFE_METHODS.has(method)) {
    headers["X-CSRF-Token"] = await fetchCsrfToken();
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (data.csrfToken) csrfToken = data.csrfToken;
  if (response.status === 403 && data.error?.toLowerCase?.().includes("csrf")) {
    csrfToken = null;
  }
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}
