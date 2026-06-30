// src/components/routes/RoleProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { appendLocationIdToPath } from '../utils/iframeContext';
import { isRoleAllowed } from '../utils/roleAccess';

const RoleProtectedRoute = ({ children, allowedRoles, redirectPath }) => {
  const user = useSelector((state) => state.auth.user);
  const role = user?.role || 'worker';

  if (!isRoleAllowed(role, allowedRoles)) {
    if (redirectPath) {
      return <Navigate to={appendLocationIdToPath(redirectPath)} replace />;
    }

    if (role === 'worker') {
      return <Navigate to={appendLocationIdToPath('/admin/jobs')} replace />;
    }

    return <Navigate to={appendLocationIdToPath('/admin/unauthorized')} replace />;
  }

  return children;
};

export default RoleProtectedRoute;
