import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@shared/schema";

const TOKEN_KEY = "wk_token";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  return res;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  setUserProfile: (profile: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    const token = getAuthToken();
    if (!token) {
      setCurrentUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch("/api/auth/me");
      if (res.ok) {
        const user: User = await res.json();
        setCurrentUser(user);
      } else {
        clearAuthToken();
        setCurrentUser(null);
      }
    } catch {
      clearAuthToken();
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Login failed" }));
      throw new Error(err.error || "Login failed");
    }
    const { token, user } = await res.json();
    setAuthToken(token);
    setCurrentUser(user);
  };

  const signUp = async (name: string, email: string, password: string) => {
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Registration failed" }));
      throw new Error(err.error || "Registration failed");
    }
    const { token, user } = await res.json();
    setAuthToken(token);
    setCurrentUser(user);
  };

  const logout = async () => {
    clearAuthToken();
    setCurrentUser(null);
  };

  const refreshUserProfile = async () => {
    await loadProfile();
  };

  const setUserProfile = (profile: User | null) => {
    setCurrentUser(profile);
  };

  const value: AuthContextType = {
    currentUser,
    userProfile: currentUser,
    loading,
    signIn,
    signUp,
    logout,
    refreshUserProfile,
    setUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
