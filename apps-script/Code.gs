/**
 * AYA-CHAT Clover — backend (Google Apps Script, PERSONAL Google account)
 * One URL, two jobs:
 *   1. Chat log: every message -> a row in this spreadsheet (permanent log,
 *      viewable live in the sheet or via monitor.html).
 *   2. AI proxy: calls Gemini on Vertex AI using the STUDY SERVICE-ACCOUNT
 *      key (from Secret Manager), so the shared links work anytime with no
 *      tokens in the browser.
 *
 * SETUP (~10 minutes, using a PERSONAL Google account since the
 * organization account has Apps Script disabled):
 *
 *  1. sheets.google.com -> create a blank spreadsheet, e.g. "Clover Logs".
 *  2. Extensions -> Apps Script -> delete the placeholder, paste this file.
 *  3. Get the service-account JSON key (the one your IT manager shared via
 *     Secret Manager). In the Apps Script editor: gear icon (Project
 *     Settings) -> Script Properties -> Add script property:
 *        Property: SA_KEY
 *        Value:    <paste the ENTIRE JSON key, all of it>
 *     (Script Properties keep the key out of the code itself.)
 *  4. Deploy -> New deployment -> type: Web app.
 *        Execute as: Me    |    Who has access: Anyone
 *     Authorize when prompted, and copy the Web app URL (ends in /exec).
 *  5. Paste that URL into the ⚙️ panel of the week pages (once per browser),
 *     or better: put it in assets/site-config.js so every participant link
 *     has it automatically.
 *  6. Test: run testGemini from the editor toolbar (Run button) and check
 *     the log output says ok:true.
 *
 * To update code later: Deploy -> Manage deployments -> pencil ->
 * Version: New version -> Deploy (keeps the same URL).
 */

/* ======== CONFIG ======== */
var LOCATION = "us-central1";
var MODEL = "gemini-2.5-flash";
var SHEET_NAME = "log";
/* ======================== */

var SYSTEM_PROMPT = [
  "You are Clover, a warm and supportive wellbeing chatbot for teen and young adult cancer survivors (ages ~15-29).",
  "You are in the middle of a scripted positive-psychology exercise. The participant just answered a reflection question.",
  "",
  "Your ONLY job: reply with a brief active-listening reflection (1-2 short sentences) that shows you truly heard what they shared.",
  "Techniques: reflect back the feeling or content in fresh words, validate, or highlight a strength you noticed in their answer.",
  "",
  "Rules:",
  "- Do NOT ask any questions.",
  "- Do NOT give advice, suggestions, or instructions.",
  "- Do NOT start a new topic. The script will continue after you.",
  "- Sound like a caring friend texting: casual, warm, genuine. Avoid clinical language.",
  "- At most one emoji, and only if it fits naturally.",
  "- Keep it under 30 words.",
  "- If they gave a very short or unclear answer, keep your reflection gentle and simple.",
  "- If the participant expresses thoughts of self-harm, suicide, or serious crisis, drop the format: respond with warmth, tell them their feelings matter, and encourage them to reach out right away to their care team or call/text 988 (Suicide & Crisis Lifeline)."
].join("\n");

function out_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(["ts", "participant", "week", "day", "phase", "who", "text"]);
  }
  return sh;
}

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); }
  catch (err) { return out_({ ok: false, error: "bad JSON" }); }

  if (d.action === "gemini") {
    return out_(geminiReflect_(String(d.question || ""), String(d.answer || "")));
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    getSheet_().appendRow([
      String(d.t || new Date().toISOString()),
      String(d.seed || ""),
      Number(d.week || 0),
      Number(d.day || 0),
      String(d.phase || ""),
      String(d.who || ""),
      String(d.text || "")
    ]);
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---- Service-account OAuth (JWT bearer flow), token cached ~50 min ---- */
function saToken_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("sa_token");
  if (cached) return cached;

  var raw = PropertiesService.getScriptProperties().getProperty("SA_KEY");
  if (!raw) throw new Error("SA_KEY script property not set (paste the service-account JSON key)");
  var key = JSON.parse(raw);

  var now = Math.floor(Date.now() / 1000);
  var header = Utilities.base64EncodeWebSafe(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  var claims = Utilities.base64EncodeWebSafe(JSON.stringify({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  var input = header + "." + claims;
  var signature = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(input, key.private_key)
  );
  var jwt = input + "." + signature;

  var res = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    },
    muteHttpExceptions: true
  });
  var data = JSON.parse(res.getContentText());
  if (!data.access_token) throw new Error("token exchange failed: " + res.getContentText().slice(0, 200));
  cache.put("sa_token", data.access_token, 3000);
  return data.access_token;
}

function saProject_() {
  var raw = PropertiesService.getScriptProperties().getProperty("SA_KEY");
  return JSON.parse(raw).project_id;
}

function geminiReflect_(question, answer) {
  try {
    var token = saToken_();
    var project = saProject_();
    var url = "https://" + LOCATION + "-aiplatform.googleapis.com/v1/projects/" +
      project + "/locations/" + LOCATION +
      "/publishers/google/models/" + MODEL + ":generateContent";

    var payload = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: "user",
        parts: [{
          text: "Clover asked: \"" + question.slice(0, 1000) +
            "\"\n\nParticipant answered: \"" + answer.slice(0, 2000) +
            "\"\n\nWrite Clover's brief active-listening reflection."
        }]
      }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingBudget: 0 }
      }
    };

    var res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    var bodyText = res.getContentText();
    if (code !== 200) return { ok: false, error: "Vertex HTTP " + code + ": " + bodyText.slice(0, 300) };
    var data = JSON.parse(bodyText);
    var parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    var text = parts.map(function (p) { return p.text || ""; }).join("").trim();
    if (!text) return { ok: false, error: "empty Vertex response" };
    return { ok: true, text: text };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** GET ?after=<rowNumber>&seed=<participant filter> — used by monitor.html */
function doGet(e) {
  var after = Math.max(1, Number((e.parameter && e.parameter.after) || 1));
  var seedFilter = (e.parameter && e.parameter.seed) || "";
  var sh = getSheet_();
  var last = sh.getLastRow();
  var rows = [];
  if (last > after) {
    var values = sh.getRange(after + 1, 1, last - after, 7).getValues();
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (seedFilter && String(v[1]) !== seedFilter) continue;
      rows.push({
        row: after + 1 + i,
        t: String(v[0]), seed: String(v[1]), week: v[2], day: v[3],
        phase: String(v[4]), who: String(v[5]), text: String(v[6])
      });
    }
  }
  return out_({ ok: true, last: last, rows: rows });
}

/** Run from the editor once to verify Vertex access via the SA key. */
function testGemini() {
  var r = geminiReflect_("How are you feeling today?", "Pretty good, I spent time with my dog.");
  Logger.log(JSON.stringify(r));
}
