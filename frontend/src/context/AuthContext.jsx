/**
 * Holds the logged-in user's state app-wide. On mount, tries to fetch the
 * current profile (relies on the httpOnly cookie, if present) so a page
 * refresh doesn't lose the session.
 */
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import { AuthContext } from "./auth-context";

// Pages that never need a session check — visiting them shouldn't trigger
// a /users/me call (and the refresh attempt that follows a 401 from it).
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/kiosk"];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const fetchProfile = async () => {
    try {
      const { data } = await axiosInstance.get("/users/me");
      setUser(data.data.user);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    const isPublicPath = PUBLIC_PATHS.some((path) => location.pathname.startsWith(path));
    if (isPublicPath) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount pattern, no race condition
      setLoading(false);
      return;
    }
    fetchProfile().finally(() => setLoading(false));
  }, [location.pathname]);

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