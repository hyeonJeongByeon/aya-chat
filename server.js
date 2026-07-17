/* AYA-CHAT Clover — one-shot sample server for Cloud Run.
   Serves the static site AND proxies Gemini on Vertex AI using the
   service's own ambient credentials (no keys, no tokens in the browser).

   Endpoints:
     GET  /...            -> static files (sample.html etc.)
     POST /api/clover     -> {action:"gemini", question, answer} => {ok, text}
                             {action:"log"|none, ...}           => {ok} (no-op;
                             entries also go to Cloud Run request logs)
*/
const http = require("http");
const fs = require("fs");
const path = require("path");
const { GoogleAuth } = require("google-auth-library");

const PORT = process.env.PORT || 8080;
const PROJECT = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "";
const LOCATION = process.env.VERTEX_LOCATION || "us-central1";
const MODEL = process.env.VERTEX_MODEL || "gemini-2.5-flash";

const SYSTEM_PROMPT = `You are Clover, a warm and supportive wellbeing chatbot for teen and young adult cancer survivors (ages ~15-29). You are in the middle of a scripted positive-psychology exercise. The participant just answered a reflection question.

Your ONLY job: reply with a brief active-listening reflection (1-2 short sentences) that shows you truly heard what they shared. Techniques: reflect back the feeling or content in fresh words, validate, or highlight a strength you noticed in their answer.

Rules:
- Do NOT ask any questions.
- Do NOT give advice, suggestions, or instructions.
- Do NOT start a new topic. The script will continue after you.
- Sound like a caring friend texting: casual, warm, genuine. Avoid clinical language.
- At most one emoji, and only if it fits naturally.
- Keep it under 30 words.
- If they gave a very short or unclear answer, keep your reflection gentle and simple.
- If the participant expresses thoughts of self-harm, suicide, or serious crisis, drop the format: respond with warmth, tell them their feelings matter, and encourage them to reach out right away to their care team or call/text 988 (Suicide & Crisis Lifeline).`;

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });

/* Credentials: on Cloud Run, ambient service credentials via GoogleAuth.
   On a laptop, fall back to the gcloud CLI's logged-in account
   (token cached ~45 min, auto-refreshed). */
const { execFileSync } = require("child_process");
let cliToken = null, cliTokenTime = 0;

function gcloudToken() {
  if (cliToken && Date.now() - cliTokenTime < 45 * 60 * 1000) return cliToken;
  const gcloudPath = process.env.GCLOUD_BIN || "gcloud";
  cliToken = execFileSync(gcloudPath, ["auth", "print-access-token"], { encoding: "utf8" }).trim();
  cliTokenTime = Date.now();
  return cliToken;
}

async function getAccessToken() {
  try {
    const client = await auth.getClient();
    const t = await client.getAccessToken();
    if (t && t.token) return t.token;
    throw new Error("no ADC token");
  } catch (e) {
    return gcloudToken();
  }
}

async function geminiReflect(question, answer) {
  const token = await getAccessToken();
  let project = PROJECT;
  if (!project) {
    try { project = await auth.getProjectId(); } catch (e) { project = ""; }
  }
  if (!project) throw new Error("set GCP_PROJECT env var");
  const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${project}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`;
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{
      role: "user",
      parts: [{
        text: `Clover asked: "${String(question).slice(0, 1000)}"\n\nParticipant answered: "${String(answer).slice(0, 2000)}"\n\nWrite Clover's brief active-listening reflection.`
      }]
    }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } }
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("Vertex HTTP " + res.status + ": " + (await res.text()).slice(0, 200));
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || "").join("").trim();
  if (!text) throw new Error("empty Vertex response");
  return text;
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".json": "application/json",
  ".svg": "image/svg+xml", ".ico": "image/x-icon"
};

function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/sample.html";
  const file = path.normalize(path.join(__dirname, p));
  if (!file.startsWith(__dirname) || p.includes("..")) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url.startsWith("/api/clover")) {
    let raw = "";
    req.on("data", (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on("end", async () => {
      res.setHeader("Content-Type", "application/json");
      try {
        const d = JSON.parse(raw || "{}");
        if (d.action === "gemini") {
          const text = await geminiReflect(d.question || "", d.answer || "");
          return res.end(JSON.stringify({ ok: true, text }));
        }
        // log entries: acknowledged and echoed into Cloud Run logs
        console.log("CLOVERLOG", JSON.stringify(d));
        return res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        console.error("api error:", e.message);
        res.statusCode = 500;
        return res.end(JSON.stringify({ ok: false, error: String(e.message).slice(0, 300) }));
      }
    });
    return;
  }
  if (req.method === "GET") return serveStatic(req, res);
  res.writeHead(405); res.end();
}).listen(PORT, () => console.log("clover sample server on :" + PORT));
