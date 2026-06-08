const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export function getToken() {
  return localStorage.getItem("vb_token");
}

export function setSession(session) {
  localStorage.setItem("vb_token", session.token);
  localStorage.setItem("vb_user", JSON.stringify(session.user));
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("vb_user") || "null");
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem("vb_token");
  localStorage.removeItem("vb_user");
}

export async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}
