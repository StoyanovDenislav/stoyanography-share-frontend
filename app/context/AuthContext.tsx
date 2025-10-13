"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import axiosInstance from "../utils/axiosInstance";
import axios from "axios";

interface User {
  id: string;
  username: string;
  role: "admin" | "photographer" | "client" | "guest";
  email?: string;
  businessName?: string;
  clientName?: string;
  guestName?: string;
  photographerId?: string;
  clientId?: string;
  expiresAt?: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:9001/api";

  // Configure axios to always send cookies
  axios.defaults.withCredentials = true;

  useEffect(() => {
    // Try to verify existing session with the server
    const verifySession = async () => {
      try {
        const storedUser = localStorage.getItem("user");

        // Only try to verify if we have a stored user
        if (storedUser) {
          // Verify token with backend using axios instance (will auto-refresh if needed)
          const response = await axiosInstance.get("/auth/verify");

          if (response.data.success && response.data.user) {
            setUser(response.data.user);
            localStorage.setItem("user", JSON.stringify(response.data.user));
          } else {
            // Invalid response, clear user
            setUser(null);
            localStorage.removeItem("user");
            localStorage.removeItem("mustChangePassword");
          }
        } else {
          // No stored user, just set loading to false
          setUser(null);
        }
      } catch (error) {
        // Session invalid or expired, clear user
        console.log("Session verification failed:", error);
        setUser(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("user");
          localStorage.removeItem("mustChangePassword");
        }
      } finally {
        setIsLoading(false);
      }
    };

    verifySession();
  }, []);

  const login = async (
    username: string,
    password: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);

      console.log("Attempting login to:", `${API_BASE_URL}/auth/login`);
      console.log("With credentials:", { username, password: "***" });

      const response = await axiosInstance.post("/auth/login", {
        username,
        password,
      });

      console.log("Login response:", response.data);

      if (response.data.success) {
        const { user: userData, mustChangePassword } = response.data;

        setUser(userData);

        // Store user data in localStorage for quick access (token is in cookie)
        if (typeof window !== "undefined") {
          localStorage.setItem("user", JSON.stringify(userData));

          // Store mustChangePassword flag for redirect
          if (mustChangePassword) {
            localStorage.setItem("mustChangePassword", "true");
          }
        }

        return true;
      }

      return false;
    } catch (error) {
      console.error("Login error:", error);
      if (axios.isAxiosError(error)) {
        console.error("Response data:", error.response?.data);
        console.error("Response status:", error.response?.status);
        console.error("Request URL:", error.config?.url);
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call backend logout to clear the cookies
      await axiosInstance.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);

      // Clear localStorage (only in browser)
      if (typeof window !== "undefined") {
        localStorage.removeItem("user");
        localStorage.removeItem("mustChangePassword");
      }
    }
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
