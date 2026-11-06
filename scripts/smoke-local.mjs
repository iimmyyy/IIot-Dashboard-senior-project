const baseUrl = process.env.BIODRY_SMOKE_URL ?? "http://localhost:3000";

const credentials = {
  staff: process.env.BIODRY_SMOKE_STAFF_PASSWORD,
  researcher: process.env.BIODRY_SMOKE_RESEARCHER_PASSWORD,
  professor: process.env.BIODRY_SMOKE_PROFESSOR_PASSWORD,
};

for (const [role, password] of Object.entries(credentials)) {
  if (!password)
    throw new Error(`Missing BIODRY_SMOKE_${role.toUpperCase()}_PASSWORD.`);
}

function cookieJar(response) {
  const values = response.headers.getSetCookie?.() ?? [];
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function login(username, password) {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok)
    throw new Error(
      `${username} login failed: ${response.status} ${await response.text()}`,
    );
  const body = await response.json();
  return { cookie: cookieJar(response), csrf: body.csrf_token };
}

async function request(path, session, init = {}) {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Origin: baseUrl,
      Cookie: session?.cookie ?? "",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(session?.csrf ? { "X-CSRF-Token": session.csrf } : {}),
      ...init.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

const health = await fetch(`${baseUrl}/api/v1/health`).then((response) =>
  response.json(),
);
if (health.status !== "ok") throw new Error("Health check failed.");

const unauthenticated = await request("/daily-records", null);
if (unauthenticated.response.status !== 401)
  throw new Error("Expected unauthenticated 401.");

const staff = await login("staff", credentials.staff);
const researcher = await login("researcher", credentials.researcher);
const professor = await login("professor", credentials.professor);

for (const [role, session] of Object.entries({
  staff,
  researcher,
  professor,
})) {
  const me = await request("/auth/me", session);
  if (!me.response.ok || me.body.role !== role)
    throw new Error(`${role} /auth/me mismatch.`);
}

const experiments = await request("/experiments", staff);
if (!experiments.response.ok || !experiments.body.length)
  throw new Error("No experiment is available.");
const experiment =
  experiments.body.find((item) => item.status === "running") ??
  experiments.body[0];

const forbidden = await request("/daily-records", researcher, {
  method: "POST",
  body: JSON.stringify({
    experiment_id: experiment.id,
    record_date: new Date().toISOString().slice(0, 10),
    historical_label: `forbidden-${Date.now()}`,
    values: { temperature_top_c: 55 },
    revision_reason: "Unauthorized smoke attempt",
  }),
});
if (forbidden.response.status !== 403)
  throw new Error("Expected wrong-role 403.");

const created = await request("/daily-records", staff, {
  method: "POST",
  body: JSON.stringify({
    experiment_id: experiment.id,
    record_date: new Date().toISOString().slice(0, 10),
    historical_label: `smoke-${Date.now()}`,
    values: {
      temperature_top_c: 58.1,
      temperature_middle_c: 60.2,
      temperature_bottom_c: 55.4,
    },
    revision_reason: "Local Compose smoke test",
  }),
});
if (created.response.status !== 201)
  throw new Error(`Create failed: ${JSON.stringify(created.body)}`);

const recordId = created.body.id;
for (const [action, session] of [
  ["submit", staff],
  ["validate", researcher],
  ["certify", professor],
]) {
  const result = await request(`/measurements/${recordId}/${action}`, session, {
    method: "POST",
    body: JSON.stringify({ comment: `Smoke test ${action}` }),
  });
  if (!result.response.ok)
    throw new Error(`${action} failed: ${JSON.stringify(result.body)}`);
}

const completion = await request(
  `/experiments/${experiment.id}/completion-requests`,
  researcher,
  {
    method: "POST",
    body: JSON.stringify({
      rationale: "Certified smoke-test measurements are ready for review.",
    }),
  },
);
if (completion.response.status !== 201)
  throw new Error("Completion request failed.");

const approval = await request(
  `/approvals/${completion.body.id}/approve`,
  professor,
  {
    method: "POST",
    body: JSON.stringify({
      comment: "Approved by the local Compose smoke test.",
    }),
  },
);
if (!approval.response.ok) throw new Error("Completion approval failed.");

console.log(
  "BioDry local stack smoke test passed: auth, 401/403, workflow, audit transaction, and completion approval.",
);
