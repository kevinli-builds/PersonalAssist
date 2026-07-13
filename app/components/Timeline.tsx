"use client";

import { useState } from "react";
import { deleteEntry, updateEntry, type Entry } from "../lib/api";

const TYPE_ICONS: Record<string, string> = {
  event: "🎟️",
  health: "💉",
  birthday: "🎂",
  task: "✅",
  note: "📝",
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isUpcoming(entry: Entry): boolean {
  const now = Date.now();
  if (entry.date && new Date(entry.date).getTime() >= now) return true;
  return entry.reminders.some((r) => !r.sent && new Date(r.remindAt).getTime() >= now);
}

// Entry.date ⇄ <input type="date"> in the user's local calendar (day precision).
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromDateInput(value: string): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d).toISOString(); // local midnight → the day the user meant
}

function Card({ entry, onDelete, onChanged }: { entry: Entry; onDelete: (id: string) => void; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const [note, setNote] = useState(entry.note);
  const [date, setDate] = useState(toDateInput(entry.date));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const startEdit = () => {
    setTitle(entry.title);
    setNote(entry.note);
    setDate(toDateInput(entry.date));
    setError("");
    setEditing(true);
  };

  const save = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await updateEntry(entry.id, { title: title.trim(), note: note.trim(), date: fromDateInput(date) });
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const nextReminder = entry.reminders.find((r) => !r.sent && new Date(r.remindAt).getTime() > Date.now());

  if (editing) {
    return (
      <div className="entry-card">
        <div className="entry-edit">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" aria-label="Note" />
          {error && <p className="error">{error}</p>}
          <div className="entry-edit-actions">
            <button className="ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
            <button className="save" onClick={save} disabled={busy || !title.trim()}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="entry-card">
      <div className="entry-head">
        <span className="badge">{TYPE_ICONS[entry.type] ?? "📝"} {entry.type}</span>
        <strong>{entry.title}</strong>
        <button className="edit" title="Edit" onClick={startEdit}>
          ✏️
        </button>
        <button className="delete" title="Delete" onClick={() => onDelete(entry.id)}>
          ✕
        </button>
      </div>
      {entry.date && <div className="muted">📆 {formatDate(entry.date)}{entry.recurrence === "yearly" ? " · 🔁 yearly" : ""}</div>}
      {entry.note && <div className="muted">🗒️ {entry.note}</div>}
      {nextReminder && (
        <div className="muted">
          🔔 {new Date(nextReminder.remindAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} — {nextReminder.label}
        </div>
      )}
    </div>
  );
}

export default function Timeline({ entries, onChanged }: { entries: Entry[]; onChanged: () => void }) {
  const [error, setError] = useState("");

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this entry?")) return;
    try {
      await deleteEntry(id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const upcoming = entries.filter(isUpcoming).sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
  const past = entries.filter((e) => !isUpcoming(e));

  return (
    <section>
      {error && <p className="error">{error}</p>}
      {entries.length === 0 && <p className="muted center">Nothing here yet — go capture something.</p>}

      {upcoming.length > 0 && (
        <>
          <h2>Upcoming</h2>
          {upcoming.map((e) => (
            <Card key={e.id} entry={e} onDelete={handleDelete} onChanged={onChanged} />
          ))}
        </>
      )}

      {past.length > 0 && (
        <>
          <h2>History</h2>
          {past.map((e) => (
            <Card key={e.id} entry={e} onDelete={handleDelete} onChanged={onChanged} />
          ))}
        </>
      )}
    </section>
  );
}
