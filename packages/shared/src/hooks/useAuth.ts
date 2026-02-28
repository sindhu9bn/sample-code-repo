// packages/shared/src/hooks/useAuth.ts
// Authentication hook — used by web and mobile.
// Handles login, logout, token refresh scheduling.
// CODEBASE.md flags this as a known fragile area.

import { useState, useEffect, useCallback, useRef } from "react";
import { AuthTokens, User, ApiResponse } from "../types";
import { apiRequest, storeTokens, clearTokens, getStoredTokens } from "../api/client";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UseAuthReturn extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshSession: () => Promise<void>;
}

/**
 * BUG 12 (SECURITY - CRITICAL): Password logged on login failure.
 * If login fails, the error log includes the password in plain text.
 * This would appear in browser devtools, crash reporting tools (Sentry etc),
 * and any log aggregation. Catastrophic for a fintech app.
 */
export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  // Ref to hold the refresh timer so we can clear it on unmount
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Schedule a token refresh 1 minute before expiry.
   *
   * BUG 13 (MEDIUM): Memory leak — timer not always cleared.
   * If the component using this hook unmounts (e.g. user navigates away),
   * the timer keeps running and will attempt to setState on an unmounted component.
   * The cleanup in useEffect below only runs on unmount of the hook's host component.
   * If refreshSession is called after unmount, it will still setState.
   */
  const scheduleRefresh = useCallback((tokens: AuthTokens) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    const refreshIn = tokens.expiresAt - Date.now() - 60_000; // 1 min before expiry

    if (refreshIn > 0) {
      refreshTimerRef.current = setTimeout(() => {
        refreshSession(); // eslint-disable-line
      }, refreshIn);
    }
  }, []); // BUG 14: refreshSession missing from deps array — stale closure

  const refreshSession = useCallback(async () => {
    const tokens = getStoredTokens();
    if (!tokens) return;

    const response = await apiRequest<{ tokens: AuthTokens; user: User }>(
      "/auth/refresh",
      {
        method: "POST",
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      }
    );

    if (response.success && response.data) {
      storeTokens(response.data.tokens);
      scheduleRefresh(response.data.tokens);
      setState((prev) => ({ ...prev, user: response.data.user }));
    } else {
      // Refresh failed — log user out
      logout();
    }
  }, [scheduleRefresh]);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await apiRequest<{ tokens: AuthTokens; user: User }>(
          "/auth/login",
          {
            method: "POST",
            body: JSON.stringify({ email, password }),
          }
        );

        if (response.success && response.data) {
          storeTokens(response.data.tokens);
          scheduleRefresh(response.data.tokens);
          setState({
            user: response.data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return true;
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: response.error,
          }));
          // BUG 12: Password exposed in log
          console.error("Login failed for", email, "with password", password);
          return false;
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Network error",
        }));
        return false;
      }
    },
    [scheduleRefresh]
  );

  const logout = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    clearTokens();
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  }, []);

  // On mount: check if we have stored tokens and restore session
  useEffect(() => {
    const tokens = getStoredTokens();

    if (!tokens) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    if (Date.now() > tokens.expiresAt) {
      // Tokens expired — try refresh
      refreshSession().finally(() => {
        setState((prev) => ({ ...prev, isLoading: false }));
      });
    } else {
      // Tokens valid — restore session
      scheduleRefresh(tokens);
      apiRequest<User>("/auth/me").then((response) => {
        if (response.success) {
          setState({
            user: response.data,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      });
    }

    // Cleanup timer on unmount
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []); // intentionally empty — runs once on mount

  return { ...state, login, logout, refreshSession };
}
