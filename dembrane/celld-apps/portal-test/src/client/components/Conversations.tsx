import { type Conversation, useGet } from "../api";
import { ErrorText } from "./ErrorText";

export function Conversations({ projectId }: { projectId: string }) {
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
