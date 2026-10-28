// Netlify Function: POST /api/chat. Keeps the OpenAI key on the server.
import { respond, rateLimited } from "../../assistant/core.mjs";

export const config = { path: "/api/chat" };

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export default async (req, context) => {
  if (req.method !== "POST") return json(405, { error: "Use POST." });
  const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "unknown";
  if (rateLimited(ip)) return json(429, { error: "You are sending messages quickly. Please wait a minute and try again." });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: "Request was not valid." }); }
  const out = await respond(body, { apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || undefined });
  return json(out.status, out.json);
};
