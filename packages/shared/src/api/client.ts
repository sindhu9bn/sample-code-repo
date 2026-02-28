// packages/shared/src/api/client.ts
// Central HTTP client used by all hooks.
// All API calls go through here — auth headers, error handling, base URL.

import { AuthTokens, ApiResponse } from "../types";

const BASE_URL = process.env.REACT_APP_API_URL || "https://api.finpay.com/v1";

/**
 * BUG 5 (SECURITY - CRITICAL): Tokens stored in localStorage.
 * localStorage is accessible to any JavaScript on the page — XSS vulnerability.
 * Should use httpOnly cookies (set by server) or at minimum sessionStorage
 * with short expiry. For a fintech app this is a serious security issue.
 */
function getStoredTokens(): AuthTokens | null {
  const raw = localStorage.getItem("finpay_auth_tokens"); // XSS risk
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function storeTokens(tokens: AuthTokens): void {
  localStorage.setItem("finpay_auth_tokens", JSON.stringify(tokens)); // XSS risk
}

function clearTokens(): void {
  localStorage.removeItem("finpay_auth_tokens");
}

/**
 * Refreshes the access token using the refresh token.
 *
 * BUG 6 (CRITICAL): Race condition on token refresh.
 * If two API calls fire simultaneously and both get 401,
 * both will attempt to refresh the token at the same time.
 * The second refresh call will likely fail (refresh token already used),
 * logging the user out unexpectedly.
 * Fix: Use a refresh lock / singleton promise pattern.
 */
async function refreshAccessToken(): Promise<AuthTokens | null> {
  const tokens = getStoredTokens();
  if (!tokens?.refreshToken) return null;

  // No lock here — concurrent calls will both attempt this
  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });

  if (!response.ok) {
    clearTokens();
    return null;
  }

  const newTokens = await response.json();
  storeTokens(newTokens);
  return newTokens;
}

/**
 * Core request function. Handles auth headers and token refresh.
 *
 * BUG 7 (SECURITY): Verbose error messages expose internals.
 * The raw server error message is returned directly to callers,
 * which may include stack traces, SQL errors, or internal field names.
 * Should map to safe user-facing messages.
 *
 * BUG 8 (MEDIUM): No request timeout.
 * A slow server response will hang the UI indefinitely.
 * Should use AbortController with a timeout.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  let tokens = getStoredTokens();

  // Check if token is expired before making the call
  if (tokens && Date.now() > tokens.expiresAt) {
    tokens = await refreshAccessToken();
    if (!tokens) {
      return { data: null as T, error: "Session expired", success: false };
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  // No AbortController / timeout here
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token might have expired mid-request — try refresh once
    tokens = await refreshAccessToken(); // race condition: no lock
    if (!tokens) {
      return { data: null as T, error: "Session expired", success: false };
    }
    // Retry with new token
    const retryResponse = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, Authorization: `Bearer ${tokens.accessToken}` },
    });
    const retryData = await retryResponse.json();
    return retryData;
  }

  if (!response.ok) {
    const errorData = await response.json();
    // BUG 7: Returning raw server error — may contain sensitive internals
    return {
      data: null as T,
      error: errorData.message || "Request failed",
      success: false,
    };
  }

  const data = await response.json();
  return { data, error: null, success: true };
}

export { storeTokens, clearTokens, getStoredTokens };
