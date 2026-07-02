"use client";

import type { ParsedEntry } from "@/lib/claude";

const TOKEN_KEY = "pa_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export type Reminder = {
  id: string;
  remindAt: string;
  label: string;
  sent: boolean;
};

export type Entry = {
  id: string;
  type: "event" | "health" | "birthday" | "task" | "note";
  title: string;
  date: string | null;
  recurrence: string | null;
  tags: string;
  note: string;
  raw: string;
  createdAt: string;
  reminders: Reminder[];
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    clearToken();
    throw new ApiError(401, "Session expired — log in again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  return data as T;
}

export async function login(password: string): Promise<void> {
  const { token } = await api<{ token: string }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  setToken(token);
}

function clientNow() {
  return {
    now: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export function parseMessage(message: string) {
  return api<{ parsed: ParsedEntry; raw: string }>("/api/parse", {
    method: "POST",
    body: JSON.stringify({ message, ...clientNow() }),
  });
}

export function saveEntry(parsed: ParsedEntry, raw: string) {
  return api<{ entry: Entry }>("/api/entries", {
    method: "POST",
    body: JSON.stringify({ parsed, raw }),
  });
}

export function listEntries() {
  return api<{ entries: Entry[] }>("/api/entries");
}

export function deleteEntry(id: string) {
  return api<{ ok: boolean }>(`/api/entries/${id}`, { method: "DELETE" });
}

export function ask(question: string) {
  return api<{ answer: string }>("/api/ask", {
    method: "POST",
    body: JSON.stringify({ question, now: new Date().toISOString() }),
  });
}

// --- Web Push ---

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function enableNotifications(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("This browser doesn't support push notifications. On iPhone, install the app to your home screen first.");
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("Push is not configured (missing NEXT_PUBLIC_VAPID_PUBLIC_KEY).");

  const registration = await navigator.serviceWorker.register("/sw.js");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was denied.");

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });
  await api("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify(subscription.toJSON()),
  });
}
