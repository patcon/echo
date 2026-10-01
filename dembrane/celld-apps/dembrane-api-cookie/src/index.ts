// dembrane's session is a Better Auth cookie, `dembrane.session_token`
// (`__Secure-dembrane.session_token` over https). Its value is an opaque,
// signed session id, not a JWT, so the Worker can't check it itself: only the
// API, which holds the sessions table, can say whose it is. So the Worker
// passes the cookie on to the API and lets the API answer as that user.
//
// The browser sends the cookie here because the Worker is inside its domain:
// `localhost` locally (cookies ignore the port), and `.dembrane.com` in
// production (AUTH_COOKIE_DOMAIN).

const SESSION_COOKIE = /^(__Secure-)?dembrane\.session_token$/;

// Only the session cookie goes on to the API, not every cookie the browser
// holds for the domain.
function sessionCookie(req: Request): string | null {
  for (const pair of (req.headers.get("cookie") ?? "").split(/;\s*/)) {
    const name = pair.slice(0, pair.indexOf("="));
    if (SESSION_COOKIE.test(name)) return pair;
  }
  return null;
}

// GET an API path as the user, passing the API's status and body straight back.
async function asUser(env: Env, req: Request, path: string): Promise<Response> {
  const cookie = sessionCookie(req);
  if (!cookie) return Response.json({ error: "not logged in" }, { status: 401 });
  const res = await fetch(new URL(path, env.API_URL), {
    headers: { cookie, accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
  });
}

export default {
  async fetch(req, env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (req.method !== "GET") return new Response("method not allowed", { status: 405 });
    switch (pathname) {
      case "/api/config":
        return Response.json({ dashboardUrl: env.DASHBOARD_URL });
      case "/api/me":
        return asUser(env, req, "/api/v2/me");
      case "/api/projects":
        return asUser(env, req, "/api/v2/bff/projects");
      case "/api/conversations": {
        // ?project_id=… The API checks that you may read that project.
        const projectId = new URL(req.url).searchParams.get("project_id");
        if (!projectId) return Response.json({ error: "project_id is required" }, { status: 400 });
        const query = new URLSearchParams({
          project_id: projectId,
          fields: "id,title,participant_name,created_at",
          limit: "100",
        });
        return asUser(env, req, `/api/v2/bff/conversations?${query}`);
      }
      case "/":
        // celld serves no index.html for `/`, so the request falls through to here.
        return env.ASSETS.fetch(new URL("/index.html", req.url));
      default:
        return new Response("not found", { status: 404 });
    }
  },
} satisfies ExportedHandler<Env>;
