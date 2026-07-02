"use client";

import { useState } from "react";
import { deleteEntry, type Entry } from "../lib/api";

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

function Card({ entry, onDelete }: { entry: Entry; onDelete: (id: string) => void }) {
  const nextReminder = entry.reminders.find((r) => !r.sent && new Date(r.remindAt).getTime() > Date.now());
  return (
    <div className="entry-card">
      <div className="entry-head">
        <span className="badge">{TYPE_ICONS[entry.type] ?? "📝"} {entry.type}</span>
        <strong>{entry.title}</strong>
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
            <Card key={e.id} entry={e} onDelete={handleDelete} />
          ))}
        </>
      )}

      {past.length > 0 && (
        <>
          <h2>History</h2>
          {past.map((e) => (
            <Card key={e.id} entry={e} onDelete={handleDelete} />
          ))}
        </>
      )}
    </section>
  );
}
