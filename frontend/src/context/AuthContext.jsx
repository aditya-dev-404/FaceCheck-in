import { useState, useEffect } from "react";
import axiosInstance from "../api/axiosInstance";
import { AuthContext } from "./auth-context";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const { data } = await axiosInstance.get("/users/me");
      setUser(data.data.user);
      return data.data.user;
    } catch {
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const { data } = await axiosInstance.get("/users/me");
        if (isMounted) {
          setUser(data.data.user);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password) => {
    const { data } = await axiosInstance.post("/auth/login", { email, password });
    setUser(data.data.user);
  };

  const register = async ({ name, email, password, organizationName, organizationCode, categories }) => {
    const { data } = await axiosInstance.post("/auth/register", {
      name,
      email,
      password,
      organizationName,
      organizationCode,
      categories,
    });
    setUser(data.data.user);
  };

  const logout = async () => {
    await axiosInstance.post("/auth/logout");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser: fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};