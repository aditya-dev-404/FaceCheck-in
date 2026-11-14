/**
 * Wraps routes that require a logged-in user. Shows nothing while the
 * initial auth check is in flight, then redirects to /login if there's
 * no user. A logged-in person with no active organization (left, removed,
 * or waiting on an invite) sees the NoOrganization screen on every
 * protected route; everyone else gets the shared Navbar + the route.
 */
import { Navigate, Outlet } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import Navbar from "./Navbar";
import NoOrganization from "../pages/NoOrganization";

const ProtectedRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <>
      <Navbar />
      {user.organization ? <Outlet /> : <NoOrganization />}
    </>
  );
};

export default ProtectedRoute;