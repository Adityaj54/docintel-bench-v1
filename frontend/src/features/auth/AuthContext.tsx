import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiError, post, setCsrfToken } from "../../api/client";
import type { Session, User } from "../../types/domain";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
  accept: (session: Session) => void;
  logout: () => Promise<void>;
  reload: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [revision, setRevision] = useState(0);
  const accept = useCallback((session: Session) => {
    setUser(session);
    setCsrfToken(session.csrf_token);
    setError(null);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api<Session>("/auth/me", { signal: controller.signal }).then(accept).catch(failure => {
      if (controller.signal.aborted) return;
      if (failure instanceof ApiError && failure.status === 401) {
        setUser(null);
        setError(null);
      } else {
        setError(failure instanceof Error ? failure : new Error("Could not load session."));
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [accept, revision]);
  useEffect(() => {
    function expire() {
      setCsrfToken("");
      setUser(null);
    }
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);
  async function logout() {
    await post("/auth/logout");
    setCsrfToken("");
    setUser(null);
  }
  return <AuthContext.Provider value={{
    user, loading, error, accept, logout, reload: () => setRevision(value => value + 1),
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider is required.");
  return context;
}
