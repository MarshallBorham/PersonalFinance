import { createContext, useContext, useState, ReactNode } from "react";

interface AuthContextValue {
  token:      string | null;
  username:   string | null;
  isLoggedIn: boolean;
  login:      (token: string, username: string) => void;
  logout:     () => void;
  authFetch:  (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token,    setToken]    = useState<string | null>(() => sessionStorage.getItem("token"));
  const [username, setUsername] = useState<string | null>(() => sessionStorage.getItem("username"));

  function login(newToken: string, newUsername: string) {
    sessionStorage.setItem("token",    newToken);
    sessionStorage.setItem("username", newUsername);
    setToken(newToken);
    setUsername(newUsername);
  }

  function logout() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("username");
    setToken(null);
    setUsername(null);
  }

  function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }

  return (
    <AuthContext.Provider value={{ token, username, isLoggedIn: !!token, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
