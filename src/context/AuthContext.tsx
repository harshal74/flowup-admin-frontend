import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

import API from "../lib/api";
import type { AdminUser } from "../types";

interface AuthContextType {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{
    success: boolean;
    error?: string;
  }>;
  logout: () => void;
}

const AuthContext =
  createContext<AuthContextType | undefined>(
    undefined
  );

const AUTH_TOKEN_KEY =
  "flowup_admin_token";

const AUTH_USER_KEY =
  "flowup_admin_user";

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] =
    useState<AdminUser | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  useEffect(() => {
    try {
      const storedUser =
        localStorage.getItem(
          AUTH_USER_KEY
        );

      const token =
        localStorage.getItem(
          AUTH_TOKEN_KEY
        );

      if (storedUser && token) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      localStorage.removeItem(
        AUTH_USER_KEY
      );

      localStorage.removeItem(
        AUTH_TOKEN_KEY
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> => {
    try {
      setIsLoading(true);

      const response =
        await API.post(
          "/auth/login",
          {
            email,
            password,
          }
        );

      const data =
        response.data;

      if (!data.success) {
        return {
          success: false,
          error:
            data.message ||
            "Login failed",
        };
      }

      const token =
        data.token;

      const userData =
        data.admin;

      localStorage.setItem(
        AUTH_TOKEN_KEY,
        token
      );

      localStorage.setItem(
        AUTH_USER_KEY,
        JSON.stringify(userData)
      );

      setUser(userData);

      return {
        success: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error:
          error?.response?.data
            ?.message ||
          "Invalid email or password",
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout =
    useCallback(() => {
      localStorage.removeItem(
        AUTH_TOKEN_KEY
      );

      localStorage.removeItem(
        AUTH_USER_KEY
      );

      setUser(null);
    }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated:
          !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return context;
}