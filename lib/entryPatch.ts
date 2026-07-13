// Validation for PATCH /api/entries/[id] — the inline "edit entry" feature.
// Pure so it can be unit-tested without a DB. Only the fields a human would
// fix by hand are editable (title / note / date); type, tags, recurrence and
// reminders stay owned by the parse flow.

export type EntryPatchData = {
  title?: string;
  note?: string;
  date?: Date | null;
};

export type EntryPatchResult = { data: EntryPatchData; error?: never } | { data?: never; error: string };

export function sanitizeEntryPatch(body: unknown): EntryPatchResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Invalid request body" };
  }
  const b = body as Record<string, unknown>;
  const data: EntryPatchData = {};

  if ("title" in b) {
    if (typeof b.title !== "string") return { error: "title must be a string" };
    const title = b.title.trim().slice(0, 300);
    if (!title) return { error: "title cannot be empty" };
    data.title = title;
  }

  if ("note" in b) {
    if (typeof b.note !== "string") return { error: "note must be a string" };
    data.note = b.note.trim().slice(0, 5000); // empty string clears the note
  }

  if ("date" in b) {
    if (b.date === null) {
      data.date = null; // explicit null clears the date
    } else if (typeof b.date === "string") {
      const d = new Date(b.date);
      if (Number.isNaN(d.getTime())) return { error: "date is not a valid date" };
      data.date = d;
    } else {
      return { error: "date must be an ISO string or null" };
    }
  }

  if (Object.keys(data).length === 0) return { error: "Nothing to update" };
  return { data };
}
