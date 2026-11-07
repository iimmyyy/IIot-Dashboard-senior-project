import type { SessionUser, UserRole } from "@/lib/auth/types";

export function roleForProject(
  user: SessionUser,
  projectId?: string,
): UserRole | null {
  if (!projectId) return null;
  return (
    user.memberships?.find((membership) => membership.projectId === projectId)
      ?.role ?? null
  );
}

export function canEnterMeasurements(user: SessionUser, projectId?: string) {
  return roleForProject(user, projectId) !== null;
}

export function canReviewAudit(user: SessionUser, projectId?: string) {
  const role = roleForProject(user, projectId);
  return role === "researcher" || role === "professor";
}
