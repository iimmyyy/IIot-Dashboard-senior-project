export const userRoles = ["professor", "researcher", "staff"] as const;

export type UserRole = (typeof userRoles)[number];

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  isSystemAdmin?: boolean;
  memberships?: Array<{
    projectId: string;
    projectCode: string;
    projectName: string;
    role: UserRole;
  }>;
};

export type AuthSession = {
  user: SessionUser;
  issuedAt: number;
  expiresAt: number;
};

export const roleLabels: Record<UserRole, string> = {
  professor: "Professor",
  researcher: "Researcher",
  staff: "Staff",
};
