import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import  useAuth  from '../hooks/useAuth';

const PublicRoute = () => {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
};

export default PublicRoute;