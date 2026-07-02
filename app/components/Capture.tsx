"use client";

import { useState } from "react";
import { parseMessage, saveEntry } from "../lib/api";
import type { ParsedEntry } from "@/lib/claude";

const TYPE_ICONS: Record<string, string> = {
  event: "🎟️",
  health: "💉",
  birthday: "🎂",
  task: "✅",
  note: "📝",
};

function formatDate(iso: string | null): string {
  if (!iso) return "no date";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Capture({ onSaved }: { onSaved: () => void }) {
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<{ parsed: ParsedEntry; raw: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError("");
    setSavedMsg("");
    try {
      const result = await parseMessage(message.trim());
      setDraft(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      await saveEntry(draft.parsed, draft.raw);
      setDraft(null);
      setMessage("");
      setSavedMsg("Saved ✓");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <form onSubmit={submit} className="capture-form">
        <textarea
          placeholder={'Tell me anything…\n"Just donated blood — remind me when I can again"\n"Got my flu shot today"\n"Hamilton tickets for March 14, row F seats 12–13"'}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !message.trim()}>
          {busy && !draft ? "Thinking…" : "Remember this"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {savedMsg && <p className="success">{savedMsg}</p>}

      {draft && (
        <div className="confirm-card">
          <p className="confirmation">{draft.parsed.confirmation}</p>
          <div className="draft-details">
            <div>
              <span className="badge">{TYPE_ICONS[draft.parsed.type] ?? "📝"} {draft.parsed.type}</span>
              <strong> {draft.parsed.title}</strong>
            </div>
            <div className="muted">📆 {formatDate(draft.parsed.date)}</div>
            {draft.parsed.recurrence && <div className="muted">🔁 {draft.parsed.recurrence}</div>}
            {draft.parsed.note && <div className="muted">🗒️ {draft.parsed.note}</div>}
            {draft.parsed.reminders.length > 0 && (
              <ul className="reminder-list">
                {draft.parsed.reminders.map((r, i) => (
                  <li key={i}>🔔 {formatDate(r.remindAt)} — {r.label}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="confirm-actions">
            <button onClick={confirm} disabled={busy}>
              {busy ? "Saving…" : "Looks right — save it"}
            </button>
            <button className="ghost" onClick={() => setDraft(null)} disabled={busy}>
              Discard
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
