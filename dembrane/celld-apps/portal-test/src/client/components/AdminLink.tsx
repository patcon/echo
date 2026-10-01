import { useRef, useState } from "react";
import { type ProjectDetail, useGet } from "../api";
import { Conversations } from "./Conversations";

// The project roles that get the admin link. Owners can do all an admin can.
const ADMIN_ROLES = ["admin", "owner"];

// Shown only to someone logged in to dembrane with an admin role on the project.
// Participants aren't logged in, so for them /api/projects/… is a 401 and this is nothing.
export function AdminLink({ projectId }: { projectId: string }) {
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
