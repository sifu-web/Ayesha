import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from './LoadingScreen';

export default function ProtectedRoute({ children, adminOnly = false, blockKeyUser = false }) {
  const { user, loading, isAdmin, isKeyUser } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  if (blockKeyUser && isKeyUser) return <Navigate to="/" replace />;

  return children;
}
