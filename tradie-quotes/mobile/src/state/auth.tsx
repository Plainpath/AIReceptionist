import React, { createContext, useContext, useEffect, useState } from "react";
import { api, loadToken, setToken } from "../api/client";

type AuthState = {
  ready: boolean;
  signedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (body: { businessName: string; abn: string; email: string; password: string; name: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    loadToken().then((token) => {
      setSignedIn(!!token);
      setReady(true);
    });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    await setToken(res.data.token);
    setSignedIn(true);
  };

  const signup = async (body: { businessName: string; abn: string; email: string; password: string; name: string }) => {
    const res = await api.post("/auth/signup", body);
    await setToken(res.data.token);
    setSignedIn(true);
  };

  const logout = async () => {
    await setToken(null);
    setSignedIn(false);
  };

  return <AuthContext.Provider value={{ ready, signedIn, login, signup, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
