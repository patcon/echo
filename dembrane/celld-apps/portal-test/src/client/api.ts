import { useEffect, useState } from "react";

// What the Worker's /api routes pass back from the API. Only the fields shown.
export type ParticipantProject = {
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
export type ProjectDetail = { id: string; name: string | null; role: string };
export type Conversation = {
  id: string;
  title: string | null;
  participant_name: string | null;
  created_at: string | null;
};

// A request to the Worker: loading, its JSON on a 200, or the status and body otherwise.
export type Result<T> =
  | { state: "loading" }
  | { state: "ok"; data: T }
  | { state: "error"; status: number; body: unknown };

export function useGet<T>(path: string | null): Result<T> {
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
