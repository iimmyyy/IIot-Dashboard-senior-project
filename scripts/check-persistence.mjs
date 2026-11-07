const baseUrl = process.env.BIODRY_SMOKE_URL ?? "http://localhost:3000";
const password = process.env.BIODRY_SMOKE_STAFF_PASSWORD;
if (!password) throw new Error("Missing BIODRY_SMOKE_STAFF_PASSWORD.");

const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: baseUrl },
  body: JSON.stringify({ username: "staff", password }),
});
if (!login.ok) throw new Error(`Persistence login failed: ${login.status}`);
const cookie = (login.headers.getSetCookie?.() ?? [])
  .map((value) => value.split(";", 1)[0])
  .join("; ");
const records = await fetch(`${baseUrl}/api/v1/daily-records`, {
  headers: { Cookie: cookie, Origin: baseUrl },
});
if (!records.ok) throw new Error(`Persistence read failed: ${records.status}`);
const body = await records.json();
if (!body.some((record) => record.historical_label.startsWith("smoke-"))) {
  throw new Error(
    "The smoke-test record was not preserved after Compose restart.",
  );
}
console.log(
  "PostgreSQL volume persistence check passed after Compose down/up.",
);
