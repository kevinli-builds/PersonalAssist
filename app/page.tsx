"use client";

import { useCallback, useEffect, useState } from "react";
import { getToken, clearToken, listEntries, enableNotifications, type Entry } from "./lib/api";
import Login from "./components/Login";
import Capture from "./components/Capture";
import Timeline from "./components/Timeline";
import Ask from "./components/Ask";

type Tab = "capture" | "timeline" | "ask";

export default function Home() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState<Tab>("capture");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [notifStatus, setNotifStatus] = useState<"idle" | "on" | "error">("idle");
  const [notifError, setNotifError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const { entries } = await listEntries();
      setEntries(entries);
    } catch {
      setLoggedIn(false);
    }
  }, []);

  useEffect(() => {
    const has = !!getToken();
    setLoggedIn(has);
    setReady(true);
    if (has) refresh();
  }, [refresh]);

  if (!ready) return null;

  if (!loggedIn) {
    return (
      <Login
        onLogin={() => {
          setLoggedIn(true);
          refresh();
        }}
      />
    );
  }

  const handleNotifications = async () => {
    setNotifError("");
    try {
      await enableNotifications();
      setNotifStatus("on");
    } catch (err) {
      setNotifStatus("error");
      setNotifError(err instanceof Error ? err.message : "Failed to enable notifications");
    }
  };

  return (
    <main className="shell">
      <header className="topbar">
        <h1>PersonalAssist</h1>
        <div className="topbar-actions">
          <button className="ghost" onClick={handleNotifications} title="Enable push notifications">
            {notifStatus === "on" ? "🔔 On" : "🔔 Notify me"}
          </button>
          <button
            className="ghost"
            onClick={() => {
              clearToken();
              setLoggedIn(false);
            }}
          >
            Log out
          </button>
        </div>
      </header>
      {notifStatus === "error" && <p className="error">{notifError}</p>}

      <nav className="tabs">
        <button className={tab === "capture" ? "active" : ""} onClick={() => setTab("capture")}>
          ✍️ Capture
        </button>
        <button className={tab === "timeline" ? "active" : ""} onClick={() => setTab("timeline")}>
          📅 Timeline
        </button>
        <button className={tab === "ask" ? "active" : ""} onClick={() => setTab("ask")}>
          💬 Ask
        </button>
      </nav>

      {tab === "capture" && <Capture onSaved={refresh} />}
      {tab === "timeline" && <Timeline entries={entries} onChanged={refresh} />}
      {tab === "ask" && <Ask />}
    </main>
  );
}
