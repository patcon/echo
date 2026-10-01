# dembrane-api-cookie: a Worker that calls dembrane's API as you, with dembrane's cookie

A minimal example of a Worker **inside dembrane's cookie domain** calling the Bun API (`dembrane/platform`) on behalf of whoever is logged in to the dashboard. It lists the projects you can read, and each one's conversations.

It's the Bun-API version of [`dembrane-auth-cookie`](../dembrane-auth-cookie), which reads Directus's session cookie. The difference is how the Worker learns who you are:

| | [`dembrane-auth-cookie`](../dembrane-auth-cookie) | `dembrane-api-cookie` (this one) |
|---|---|---|
| **The cookie** | Directus's `directus_session_token` | Better Auth's `dembrane.session_token` (`__Secure-dembrane.session_token` over https) |
| **Its value** | A JWT, signed with `DIRECTUS_SECRET` | An opaque, signed session id. Only the API's sessions table says whose it is |
| **Who checks it** | The Worker, with the shared secret | The API. The Worker passes the cookie on and never sees who you are until the API answers |
| **Secrets in the Worker** | `DIRECTUS_SECRET` | None |

## Run it

Run `pnpm install` here, then start the local stack with `mprocs` from `dembrane/` (see "Run it locally" in [`../../platform/README.md`](../../platform/README.md)). Its `celld` proc runs this app on http://localhost:5175. On its own, `pnpm dev` runs it on celld's default, http://localhost:9876.

1. Log in to the dashboard at <http://localhost:5173>. Its `/api` proxy to the API on 8080 means Better Auth sets `dembrane.session_token` for `localhost`.
2. Open <http://localhost:5175> (not 127.0.0.1: the cookie is for `localhost`). Cookies ignore the port, so the browser sends that cookie to the Worker too, just as a cookie for `.dembrane.com` would reach `demo.dembrane.com`.

The page is React, in `src/client/`. `pnpm dev` bundles it once with esbuild into `public/dist/` before celld starts, so restart it (in mprocs, select `celld` and press `r`) after you change the page. The Worker in `src/server.ts` rebuilds on its own.

## The flow

```
 browser ──GET /api/projects──▶ Worker ──GET /api/v2/bff/projects──▶ Bun API
         cookie: dembrane.       │       cookie: dembrane.             │ Better Auth looks up
         session_token=…         │       session_token=… (only that)   │ the session, then
                                 ◀──────── status and body as-is ──────┘ listMyProjects
```

- `GET /api/me` → the API's `GET /api/v2/me`
- `GET /api/projects` → the API's `GET /api/v2/bff/projects`. A user who hasn't finished onboarding gets a 403 from the API here.
- `GET /api/conversations?project_id=…` → the API's `GET /api/v2/bff/conversations`, first 100, with only the fields the page shows. The API checks you may read the project.
- No cookie → 401 from the Worker, without calling the API.

The Worker forwards only the session cookie, not every cookie the browser holds for the domain.

## Try it with curl

```sh
# Log in the way the dashboard does, keeping the cookie.
curl -s -c me.txt localhost:8080/api/auth/sign-in/email -H 'content-type: application/json' \
  -H 'origin: http://localhost:5173' -d '{"email":"you@example.com","password":"…"}' -o /dev/null

curl localhost:5175/api/projects            # 401
curl -b me.txt localhost:5175/api/projects  # your projects
```

curl keeps cookies by host, not port, as the browser does, so the cookie from `:8080` is sent to `:5175`.

## Going to production

- **The Worker must be on dembrane.com**, and the API must set its cookie for the whole domain (`AUTH_COOKIE_DOMAIN`), as prod already does.
- **Writes need an origin check.** This demo only reads. Any page in the cookie's domain can make the browser send the cookie to the Worker, so a Worker that forwards a `POST` must first check the request came from its own origin, as [`dembrane-auth-cookie`](../dembrane-auth-cookie#the-origin-check) does.
- **The Worker can do anything you can.** It holds your session for the length of the request, so it's trusted like the dashboard.
- **Every request costs an API round trip** to look the session up. Better Auth's `cookieCache` would let a Worker check a signed cache cookie itself, but it's off.
