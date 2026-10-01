import { type ReactNode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Link, Navigate, useParams } from "react-router";
import { RouterProvider } from "react-router/dom";

// What the Worker's /api routes pass back from the API. Only the fields shown.
type ParticipantProject = {
  id: string;
  language: string | null;
  tags: { id: string; text: string }[];
  organiser_name: string | null;
  default_conversation_title: string | null;
  default_conversation_description: string | null;
  default_conversation_ask_for_participant_name: boolean | null;
  default_conversation_ask_for_participant_email: boolean | null;
  is_get_reply_enabled: boolean | null;
  is_verify_enabled: boolean | null;
  legal_basis: string | null;
  privacy_policy_url: string | null;
};
type ProjectDetail = { id: string; name: string | null; role: string };
type Conversation = {
  id: string;
  title: string | null;
  participant_name: string | null;
  created_at: string | null;
};

// The project roles that get the admin link. Owners can do all an admin can.
const ADMIN_ROLES = ["admin", "owner"];

// The project the banner links to, to try the start page with.
const EXAMPLE_PROJECT_ID = "01a0f438-ac9f-773f-a492-3cda809863cf";

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
    setResult({ state: "loading" });
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

// The portal's routes, as in frontend/src/Router.tsx's participantRouter: an
// optional language, then the project. Only `start` is here.
const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  {
    path: "/:language?/:projectId",
    children: [
      { index: true, element: <Navigate to="start" replace /> },
      { path: "start", element: <Start /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

function Home() {
  return (
    <p>
      Open a project's portal at <code>/&lt;language&gt;/&lt;project id&gt;/start</code>, such as{" "}
      <Link to={`/en-US/${EXAMPLE_PROJECT_ID}/start`}>this one</Link>.
    </p>
  );
}

function NotFound() {
  return <p>This portal only has a start page.</p>;
}

function Start() {
  const { projectId = "" } = useParams();
  const path = `/api/participant/projects/${encodeURIComponent(projectId)}`;
  const project = useGet<ParticipantProject>(path);

  if (project.state === "loading") return <p className="muted">Loading the project…</p>;
  // 404 for no such project, 403 when it isn't taking conversations.
  if (project.state === "error")
    return (
      <p>
        <ErrorText path={path} result={project} />
      </p>
    );
  const p = project.data;
  return (
    <>
      <AdminLink projectId={p.id} />
      <h2>{p.default_conversation_title || "Welcome"}</h2>
      {p.default_conversation_description && <p>{p.default_conversation_description}</p>}
      <dl className="details">
        <Detail term="Organiser">{p.organiser_name}</Detail>
        <Detail term="Language">{p.language}</Detail>
        <Detail term="Tags">{p.tags.map((t) => t.text).join(", ")}</Detail>
        <Detail term="Asks for your name">
          {yesNo(p.default_conversation_ask_for_participant_name)}
        </Detail>
        <Detail term="Asks for your email">
          {yesNo(p.default_conversation_ask_for_participant_email)}
        </Detail>
        <Detail term="Replies">{yesNo(p.is_get_reply_enabled)}</Detail>
        <Detail term="Verify">{yesNo(p.is_verify_enabled)}</Detail>
        <Detail term="Legal basis">{p.legal_basis}</Detail>
        <Detail term="Privacy policy">
          {p.privacy_policy_url && <a href={p.privacy_policy_url}>{p.privacy_policy_url}</a>}
        </Detail>
        <Detail term="Project">
          <code className="muted">{p.id}</code>
        </Detail>
      </dl>
      <button type="button" className="primary" disabled>
        Next
      </button>
    </>
  );
}

const yesNo = (v: boolean | null) => (v == null ? null : v ? "Yes" : "No");

// A row of the details, or nothing when the project leaves it empty.
function Detail({ term, children }: { term: string; children: ReactNode }) {
  if (children == null || children === "") return null;
  return (
    <>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

// Shown only to someone logged in to dembrane with an admin role on the project.
// Participants aren't logged in, so for them /api/projects/… is a 401 and this is nothing.
function AdminLink({ projectId }: { projectId: string }) {
  const detail = useGet<ProjectDetail>(`/api/projects/${encodeURIComponent(projectId)}`);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  if (detail.state !== "ok" || !ADMIN_ROLES.includes(detail.data.role)) return null;
  return (
    <>
      <button
        type="button"
        className="admin-link"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        Admin
      </button>
      <dialog ref={dialog} onClose={() => setOpen(false)}>
        <header>
          <h2>Conversations in {detail.data.name || "this project"}</h2>
          <button type="button" onClick={() => dialog.current?.close()}>
            Close
          </button>
        </header>
        {/* Mounted only while open, so the list loads when it's asked for. */}
        {open && <Conversations projectId={projectId} />}
      </dialog>
    </>
  );
}

function Conversations({ projectId }: { projectId: string }) {
  const path = `/api/conversations?project_id=${encodeURIComponent(projectId)}`;
  const conversations = useGet<Conversation[]>(path);
  if (conversations.state === "loading") return <p className="muted">Loading conversations…</p>;
  if (conversations.state === "error")
    return (
      <p>
        <ErrorText path={path} result={conversations} />
      </p>
    );
  if (!conversations.data.length) return <p>No conversations yet.</p>;
  return (
    <ul>
      {conversations.data.map((c) => {
        const date = c.created_at ? new Date(c.created_at).toLocaleString() : "";
        return (
          <li key={c.id}>
            {c.title || c.participant_name || "(untitled)"}{" "}
            {date && <span className="muted">· {date}</span>}
          </li>
        );
      })}
    </ul>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<RouterProvider router={router} />);
