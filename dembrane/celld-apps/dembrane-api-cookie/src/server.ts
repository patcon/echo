// dembrane's session is a Better Auth cookie, `dembrane.session_token`
// (`__Secure-dembrane.session_token` over https). Its value is an opaque,
// signed session id, not a JWT, so the Worker can't check it itself: only the
// API, which holds the sessions table, can say whose it is. So the Worker
// passes the cookie on to the API and lets the API answer as that user.
//
// The browser sends the cookie here because the Worker is inside its domain:
// `localhost` locally (cookies ignore the port), and `.dembrane.com` in
// production (AUTH_COOKIE_DOMAIN).

import { type Context, Hono } from "hono";
import { getCookie } from "hono/cookie";

type AppEnv = { Bindings: Env };

const SESSION_COOKIES = ["__Secure-dembrane.session_token", "dembrane.session_token"];

// Only the session cookie goes on to the API, not every cookie the browser
// holds for the domain. getCookie decodes the value, and Better Auth encodes
// its signature's `+`, `/` and `=`, so encode it again as the browser sent it.
function sessionCookie(c: Context<AppEnv>): string | null {
  const cookies = getCookie(c);
  const name = SESSION_COOKIES.find((n) => cookies[n] !== undefined);
  return name ? `${name}=${encodeURIComponent(cookies[name]!)}` : null;
}

// GET an API path as the user, passing the API's status and body straight back.
async function asUser(c: Context<AppEnv>, path: string): Promise<Response> {
  const cookie = sessionCookie(c);
  if (!cookie) return c.json({ error: "not logged in" }, 401);
  const res = await fetch(new URL(path, c.env.API_URL), {
    headers: { cookie, accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

const app = new Hono<AppEnv>();

app.get("/api/config", (c) => c.json({ dashboardUrl: c.env.DASHBOARD_URL }));
app.get("/api/me", (c) => asUser(c, "/api/v2/me"));
app.get("/api/projects", (c) => asUser(c, "/api/v2/bff/projects"));

// ?project_id=… The API checks that you may read that project.
app.get("/api/conversations", async (c) => {
  const projectId = c.req.query("project_id");
  if (!projectId) return c.json({ error: "project_id is required" }, 400);
  const query = new URLSearchParams({
    project_id: projectId,
    fields: "id,title,participant_name,created_at",
    limit: "100",
  });
  return asUser(c, `/api/v2/bff/conversations?${query}`);
});

// celld serves no index.html for `/`, so the request falls through to here.
app.get("/", (c) => c.env.ASSETS.fetch(new URL("/index.html", c.req.url)));

export default app;
