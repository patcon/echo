import type { ReactNode } from "react";
import { useParams } from "react-router";
import { type ParticipantProject, useGet } from "../api";
import { AdminLink } from "./AdminLink";
import { ErrorText } from "./ErrorText";

export function Start() {
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
