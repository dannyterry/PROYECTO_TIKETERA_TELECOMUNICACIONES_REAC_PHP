import axios from "axios";
import { API_URL } from "../config/api";

export const AUTH_TOKEN_KEY = "telecom_auth_token";
export const AUTH_USER_KEY = "telecom_auth_user";

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

function isApiUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith(API_URL)) return true;
  try {
    const target = new URL(url, window.location.origin);
    const api = new URL(API_URL, window.location.origin);
    return target.origin === api.origin;
  } catch {
    return url.includes(":3000");
  }
}

function redirectToLogin(): void {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash === "login") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  window.location.hash = "login";
  window.location.reload();
}

export function installAuthHttp(): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    const headers = new Headers(
      init?.headers ||
        (typeof input !== "string" && !(input instanceof URL) ? input.headers : undefined)
    );

    const token = getAuthToken();
    if (token && isApiUrl(url) && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response =
      typeof input === "string" || input instanceof URL
        ? await originalFetch(input, { ...init, headers })
        : await originalFetch(new Request(input, { ...init, headers }));

    if (response.status === 401 && isApiUrl(url) && !url.includes("/login")) {
      redirectToLogin();
    }

    return response;
  };

  axios.interceptors.request.use((config) => {
    const token = getAuthToken();
    const url = `${config.baseURL || ""}${config.url || ""}`;
    if (token && isApiUrl(url)) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error?.response?.status;
      const url = `${error?.config?.baseURL || ""}${error?.config?.url || ""}`;
      if (status === 401 && isApiUrl(url) && !url.includes("/login")) {
        redirectToLogin();
      }
      return Promise.reject(error);
    }
  );
}
