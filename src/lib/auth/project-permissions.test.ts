import { describe, expect, it } from "vitest";
import {
  canEnterMeasurements,
  canReviewAudit,
  roleForProject,
} from "@/lib/auth/project-permissions";
import type { SessionUser } from "@/lib/auth/types";

const user: SessionUser = {
  id: "user-1",
  username: "mixed-role",
  displayName: "Mixed Role",
  role: "researcher",
  memberships: [
    {
      projectId: "project-a",
      projectCode: "A",
      projectName: "Project A",
      role: "researcher",
    },
    {
      projectId: "project-b",
      projectCode: "B",
      projectName: "Project B",
      role: "staff",
    },
  ],
};

describe("project membership permissions", () => {
  it("uses the selected project role instead of the global user role", () => {
    expect(roleForProject(user, "project-a")).toBe("researcher");
    expect(roleForProject(user, "project-b")).toBe("staff");
    expect(roleForProject(user, "missing")).toBeNull();
  });

  it("allows scoped data entry for every membership role", () => {
    expect(canEnterMeasurements(user, "project-a")).toBe(true);
    expect(canEnterMeasurements(user, "project-b")).toBe(true);
    expect(canEnterMeasurements(user, "missing")).toBe(false);
  });

  it("does not expose technical audit events to a Staff membership", () => {
    expect(canReviewAudit(user, "project-a")).toBe(true);
    expect(canReviewAudit(user, "project-b")).toBe(false);
  });
});
