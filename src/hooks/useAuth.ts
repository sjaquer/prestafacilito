import { useState, useEffect, useCallback } from "react";

export function useAuth() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setAuthenticated(true);
          setUser(data.user);
        } else {
          setAuthenticated(false);
          setUser(null);
        }
      } else {
        setAuthenticated(false);
        setUser(null);
      }
    } catch {
      setAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (username: string) => {
    setAuthenticated(true);
    setUser(username);
  }, []);

  const logout = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        setAuthenticated(false);
        setUser(null);
        return true;
      }
    } catch (err) {
      console.error("Error al cerrar sesión", err);
    }
    return false;
  }, []);

  return {
    authenticated,
    user,
    loading,
    login,
    logout,
    checkAuth,
  };
}
