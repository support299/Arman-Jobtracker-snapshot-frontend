export const normalizePayrollRole = (role) => String(role ?? 'worker').toLowerCase();

export const canAccessPayrollTimeClock = (role, userProfile, user) => {
  if (user?.is_superuser) {
    return true;
  }

  const normalizedRole = normalizePayrollRole(role);
  const payScaleType = userProfile?.pay_scale_type;

  if (
    normalizedRole === 'admin' ||
    normalizedRole === 'supervisor' ||
    normalizedRole === 'agency'
  ) {
    return true;
  }

  return payScaleType === 'hourly';
};

export const canManagePayrollTimeOff = (user) => {
  const normalizedRole = normalizePayrollRole(user?.role);
  return (
    normalizedRole === 'admin' ||
    normalizedRole === 'supervisor' ||
    normalizedRole === 'agency' ||
    normalizedRole === 'manager'
  );
};

export const canAccessPayrollAdminSections = (role, user) => {
  if (user?.is_superuser) {
    return true;
  }

  const normalizedRole = normalizePayrollRole(role);
  return (
    normalizedRole === 'admin' ||
    normalizedRole === 'supervisor' ||
    normalizedRole === 'agency'
  );
};
