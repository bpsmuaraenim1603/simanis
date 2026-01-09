export type RoleName =
  | "User"
  | "Supervisor"
  | "Admin"
  | "Superadmin"
  | "Keuangan";

/**
 * Ambil semua role user (multi-role safe, backward compatible)
 */
export const getRoles = (user: any): RoleName[] => {
  if (!user) return [];

  // multi-role (utama)
  if (Array.isArray(user.roles)) {
    return user.roles.filter(Boolean);
  }

  // transisi
  if (user.primaryRole) {
    return [user.primaryRole];
  }

  // legacy
  if (user.role) {
    return [user.role];
  }

  return [];
};

/**
 * Cek apakah user punya role tertentu
 */
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
