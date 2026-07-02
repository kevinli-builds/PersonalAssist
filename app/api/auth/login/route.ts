import { createSession, safeEqual } from "@/lib/auth";

export async function POST(req: Request) {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    return Response.json({ error: "APP_PASSWORD is not configured on the server" }, { status: 500 });
  }
  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  if (!password || !safeEqual(password, appPassword)) {
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }
  const token = await createSession();
  return Response.json({ token });
}
