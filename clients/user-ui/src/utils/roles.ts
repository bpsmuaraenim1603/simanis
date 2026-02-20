export type RoleName =
  | "User"
  | "Supervisor"
  | "Admin"
  | "Superadmin"
  | "Keuangan";

export const getRoles = (user: any): RoleName[] => {
  if (!user) return [];

  if (Array.isArray(user.roles)) {
    return user.roles.filter(Boolean);
  }

  if (user.primaryRole) {
    return [user.primaryRole];
  }

  if (user.role) {
    return [user.role];
  }

  return [];
};

export const hasRole = (user: any, role: RoleName): boolean => {
  return getRoles(user).includes(role);
};

export const hasAnyRole = (
  user: any,
  roles: RoleName[]
): boolean => {
  const userRoles = getRoles(user);
  return roles.some((r) => userRoles.includes(r));
};
