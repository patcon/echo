import { type ReactNode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

// What the Worker's /api routes pass back from the API. Only the fields shown.
type Me = { email: string; display_name: string };
type Project = { id: string; name: string | null };
type Conversation = {
  id: string;
  title: string | null;
  participant_name: string | null;
  created_at: string | null;
};

// A request to the Worker: loading, its JSON on a 200, or the status and body otherwise.
type Result<T> =
  | { state: "loading" }
  | { state: "ok"; data: T }
  | { state: "error"; status: number; body: unknown };

function useGet<T>(path: string | null): Result<T> {
  const [result, setResult] = useState<Result<T>>({ state: "loading" });
  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(path);
      const body = await res.json().catch(() => null);
      if (!cancelled)
        setResult(
          res.ok ? { state: "ok", data: body as T } : { state: "error", status: res.status, body },
        );
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);
  return result;
}

const ErrorText = ({
  path,
  result,
}: {
  path: string;
  result: { status: number; body: unknown };
}) => (
  <span className="error">
    GET {path}: HTTP {result.status} {JSON.stringify(result.body)}
  </span>
);

function App() {
  const me = useGet<Me>("/api/me");
  const config = useGet<{ dashboardUrl: string }>(
    me.state === "error" && me.status === 401 ? "/api/config" : null,
  );

  if (me.state === "loading") return <p>Loading…</p>;
  if (me.state === "error" && me.status === 401) {
    return (
      <p>
        You're not logged in to dembrane.{" "}
        {config.state === "ok" && (
          <a href={`${config.data.dashboardUrl}/login`}>Log in on the dashboard</a>
        )}
        , then come back and reload.
      </p>
    );
  }
  if (me.state === "error")
    return (
      <p>
        <ErrorText path="/api/me" result={me} />
      </p>
    );
  return (
    <>
      <p>Logged in as {me.data.display_name || me.data.email}.</p>
      <Projects />
    </>
  );
}

function Projects() {
  const projects = useGet<Project[]>("/api/projects");
  if (projects.state === "loading") return <p className="muted">Loading projects…</p>;
  // A user who hasn't finished onboarding gets a 403 here.
  if (projects.state === "error")
    return (
      <p>
        <ErrorText path="/api/projects" result={projects} />
      </p>
    );
  if (!projects.data.length) return <p>You have no projects.</p>;
  return (
    <ul>
      {projects.data.map((p) => (
        <li key={p.id}>
          {p.name || "(untitled)"} <code className="muted">{p.id}</code>
          <Conversations projectId={p.id} />
        </li>
      ))}
    </ul>
  );
}

// Each project fetches its own conversations, so they all load at once.
function Conversations({ projectId }: { projectId: string }) {
  const path = `/api/conversations?project_id=${encodeURIComponent(projectId)}`;
  const conversations = useGet<Conversation[]>(path);
  let items: ReactNode;
  if (conversations.state === "loading") items = <li>Loading conversations…</li>;
  else if (conversations.state === "error")
    items = (
      <li>
        <ErrorText path={path} result={conversations} />
      </li>
    );
  else if (!conversations.data.length) items = <li>No conversations.</li>;
  else
    items = conversations.data.map((c) => {
      const date = c.created_at ? new Date(c.created_at).toLocaleDateString() : "";
      return (
        <li key={c.id}>
          {[c.title || c.participant_name || "(untitled)", date].filter(Boolean).join(" · ")}
        </li>
      );
    });
  return <ul className="muted">{items}</ul>;
}

createRoot(document.getElementById("root")!).render(<App />);
