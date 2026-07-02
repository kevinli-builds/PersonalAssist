import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// claude-opus-4-8 by default; set CLAUDE_MODEL=claude-haiku-4-5 to cut cost.
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

export type ParsedReminder = { remindAt: string; label: string };

export type ParsedEntry = {
  title: string;
  type: "event" | "health" | "birthday" | "task" | "note";
  date: string | null;
  recurrence: string | null;
  tags: string[];
  note: string;
  reminders: ParsedReminder[];
  confirmation: string;
};

const ENTRY_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    type: { type: "string", enum: ["event", "health", "birthday", "task", "note"] },
    date: { anyOf: [{ type: "string" }, { type: "null" }] },
    recurrence: { anyOf: [{ type: "string" }, { type: "null" }] },
    tags: { type: "array", items: { type: "string" } },
    note: { type: "string" },
    reminders: {
      type: "array",
      items: {
        type: "object",
        properties: {
          remindAt: { type: "string" },
          label: { type: "string" },
        },
        required: ["remindAt", "label"],
        additionalProperties: false,
      },
    },
    confirmation: { type: "string" },
  },
  required: ["title", "type", "date", "recurrence", "tags", "note", "reminders", "confirmation"],
  additionalProperties: false,
};

const PARSE_SYSTEM = `You are the parsing engine of a personal memory assistant. The user types short freeform messages about their life — something that happened, something coming up, or something they want to remember. Extract one structured record.

Field rules:
- title: short and scannable, e.g. "Flu vaccine", "Hamilton — Orpheum", "Mom's birthday".
- type: health (vaccines, donations, medications, appointments), event (shows, travel, plans), birthday (birthdays/anniversaries), task (something to do), note (a fact with no date or action).
- date: the primary date of the thing itself, as ISO 8601 WITH the user's UTC offset. If the user gives no time, use 09:00 local. Past dates are fine (e.g. "got a tetanus shot last March"). null only if no date applies at all.
- recurrence: "yearly" for birthdays and anniversaries. Otherwise null. (Interval facts like "can donate blood again in 8 weeks" are NOT recurrence — express them as a reminder instead.)
- tags: 1–3 lowercase tags, e.g. ["vaccine"], ["tickets", "theater"].
- note: details worth keeping verbatim — dose/lot, seat numbers, confirmation codes, locations, names. Empty string if none.
- reminders: proposed future notifications (ISO 8601 with offset, strictly in the future). Guidelines:
  * upcoming event → morning of at 09:00; add the day before at 18:00 if it involves tickets or travel
  * eligibility windows ("again in 8 weeks") → one reminder at that date, 09:00
  * birthdays → morning of the next occurrence at 09:00 (recurrence "yearly" keeps it going)
  * purely past facts with no future action → empty array
- confirmation: one friendly sentence stating your interpretation, including the date and any reminders you set. This is shown to the user to approve.

Resolve all relative dates ("yesterday", "in 8 weeks", "next Friday") against the current datetime provided. Never invent details the user didn't state.`;

export async function parseMessage(message: string, now: string, timezone: string): Promise<ParsedEntry> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: PARSE_SYSTEM,
    output_config: { format: { type: "json_schema", schema: ENTRY_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `Current datetime: ${now} (timezone: ${timezone})\n\nMessage: ${message}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to process this message.");
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("No response from model");
  return JSON.parse(text.text) as ParsedEntry;
}

export type EntryForContext = {
  type: string;
  title: string;
  date: Date | null;
  recurrence: string | null;
  tags: string;
  note: string;
  createdAt: Date;
};

const ASK_SYSTEM = `You answer questions about the user's personal records (vaccines, events, tickets, birthdays, notes). Use ONLY the entries provided. Be concise and always include the relevant dates. If the answer isn't in the entries, say you don't have a record of it — never guess.`;

export async function askQuestion(question: string, entries: EntryForContext[], now: string): Promise<string> {
  const context = entries
    .map((e) => {
      const parts = [
        `[${e.type}] ${e.title}`,
        e.date ? `date: ${e.date.toISOString()}` : null,
        e.recurrence ? `recurs: ${e.recurrence}` : null,
        e.tags ? `tags: ${e.tags}` : null,
        e.note ? `note: ${e.note}` : null,
        `logged: ${e.createdAt.toISOString().slice(0, 10)}`,
      ];
      return parts.filter(Boolean).join(" | ");
    })
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: ASK_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Current datetime: ${now}\n\nEntries:\n${context || "(no entries yet)"}\n\nQuestion: ${question}`,
      },
    ],
  });
  const text = response.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text : "Sorry, I couldn't produce an answer.";
}
