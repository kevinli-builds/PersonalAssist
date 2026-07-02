"use client";

import { useState } from "react";
import { ask } from "../lib/api";

type Exchange = { question: string; answer: string };

export default function Ask() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setBusy(true);
    setError("");
    try {
      const { answer } = await ask(q);
      setHistory((h) => [{ question: q, answer }, ...h]);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <form onSubmit={submit} className="ask-form">
        <input
          type="text"
          placeholder='"When was my last tetanus shot?"'
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={busy}
        />
        <button type="submit" disabled={busy || !question.trim()}>
          {busy ? "…" : "Ask"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}

      {history.map((x, i) => (
        <div key={i} className="qa-card">
          <p className="qa-q">{x.question}</p>
          <p className="qa-a">{x.answer}</p>
        </div>
      ))}
    </section>
  );
}
