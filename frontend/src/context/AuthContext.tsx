import { createContext, useContext, useState, ReactNode } from "react";

interface AuthContextValue {
  token:              string | null;
  username:           string | null;
  isGuest:            boolean;
  isLoggedIn:         boolean;
  onboardingComplete: boolean;
  login:              (token: string, username: string, onboardingComplete: boolean) => void;
  loginAsGuest:       () => void;
  completeOnboarding: (newToken: string) => void;
  logout:             () => void;
  authFetch:          (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeOnboarding(token: string | null): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as { onboardingComplete?: boolean };
    return payload.onboardingComplete ?? false;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token,    setToken]    = useState<string | null>(() => sessionStorage.getItem("token"));
  const [username, setUsername] = useState<string | null>(() => sessionStorage.getItem("username"));
  const [isGuest,  setIsGuest]  = useState<boolean>(() => sessionStorage.getItem("guest") === "true");
  const [onboardingComplete, setOnboardingComplete] = useState<boolean>(() =>
    decodeOnboarding(sessionStorage.getItem("token"))
  );

  function login(newToken: string, newUsername: string, onboarded: boolean) {
    sessionStorage.setItem("token",    newToken);
    sessionStorage.setItem("username", newUsername);
    sessionStorage.removeItem("guest");
    setToken(newToken);
    setUsername(newUsername);
    setIsGuest(false);
    setOnboardingComplete(onboarded);
  }

  function loginAsGuest() {
    sessionStorage.setItem("guest", "true");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("username");
    setToken(null);
    setUsername(null);
    setIsGuest(true);
    setOnboardingComplete(true); // guests skip onboarding
  }

  function completeOnboarding(newToken: string) {
    sessionStorage.setItem("token", newToken);
    setToken(newToken);
    setOnboardingComplete(true);
  }

  function logout() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("guest");
    setToken(null);
    setUsername(null);
    setIsGuest(false);
    setOnboardingComplete(false);
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
    <AuthContext.Provider value={{
      token, username, isGuest,
      isLoggedIn: !!token || isGuest,
      onboardingComplete,
      login, loginAsGuest, completeOnboarding, logout, authFetch,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
