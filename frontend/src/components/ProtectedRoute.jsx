/**
 * Wraps routes that require a logged-in user. Shows nothing while the
 * initial auth check is in flight, then redirects to /login if there's
 * no user, or renders the shared Navbar + the route otherwise.
 */
import { Navigate, Outlet } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import Navbar from "./Navbar";

const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
};

export default ProtectedRoute;