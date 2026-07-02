"use client";

import { useState } from "react";
import { login } from "../lib/api";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(password);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-screen">
      <div className="login-card">
        <h1>PersonalAssist</h1>
        <p className="tagline">Type it once. Never forget it.</p>
        <form onSubmit={submit}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={busy || !password}>
            {busy ? "…" : "Enter"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    </main>
  );
}
