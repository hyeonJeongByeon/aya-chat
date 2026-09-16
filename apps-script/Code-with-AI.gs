/**
 * AYA-CHAT Clover — backend (Google Apps Script, personal Google account)
 * No AI involved — this only does two things:
 *   1. Chat log: every message -> a row in this spreadsheet.
 *   2. Participant backup: stores each participant's onboarding answers +
 *      day progress, so they can resume on a different device/browser.
 *
 * SETUP (~5 minutes, any personal Google account):
 *  1. sheets.google.com -> create a blank spreadsheet, e.g. "Clover Logs".
 *  2. Extensions -> Apps Script -> delete the placeholder, paste this file.
 *  3. Deploy -> New deployment -> type: Web app.
 *        Execute as: Me    |    Who has access: Anyone
 *     Authorize when prompted, copy the Web app URL (ends in /exec).
 *  4. Paste that URL into assets/site-config.js (CLOVER_DEFAULT_LOG_URL)
 *     so every participant link uses it automatically — or into the ⚙️
 *     panel of each page.
 *
 * To update later: Deploy -> Manage deployments -> pencil ->
 * Version: New version -> Deploy (keeps the same URL).
 */

var SHEET_NAME = "log";
var STATE_SHEET = "state";

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

function getStateSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(STATE_SHEET);
  if (!sh) sh = ss.insertSheet(STATE_SHEET);
  if (sh.getLastRow() === 0) sh.appendRow(["pid", "updated", "state_json"]);
  return sh;
}

function doPost(e) {
  var d;
  try { d = JSON.parse(e.postData.contents); }
  catch (err) { return out_({ ok: false, error: "bad JSON" }); }

  if (d.action === "gemini") {
    return out_(geminiReflect_(String(d.mode || "reflect"), String(d.question || ""), String(d.answer || "")));
  }

  if (d.action === "stateSave") {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sh = getStateSheet_();
      var pid = String(d.pid || "");
      var rows = sh.getDataRange().getValues();
      var rowIdx = -1;
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === pid) { rowIdx = i + 1; break; }
      }
      var vals = [pid, new Date().toISOString(), JSON.stringify(d.state || {})];
      if (rowIdx > 0) sh.getRange(rowIdx, 1, 1, 3).setValues([vals]);
      else sh.appendRow(vals);
      return out_({ ok: true });
    } catch (err) {
      return out_({ ok: false, error: String(err) });
    } finally {
      lock.releaseLock();
    }
  }

  // Default: append a chat-log row.
  var lock2 = LockService.getScriptLock();
  lock2.waitLock(10000);
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
    lock2.releaseLock();
  }
}

/**
 * GET ?action=state&pid=007          -> stored settings/progress for a PID
 * GET ?after=<row>&seed=<pid filter> -> chat-log rows (monitor + resume)
 */
function doGet(e) {
  var p = e.parameter || {};

  if (p.action === "state") {
    var sh = getStateSheet_();
    var rows = sh.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(p.pid || "")) {
        var st = {};
        try { st = JSON.parse(rows[i][2]); } catch (err) {}
        return out_({ ok: true, state: st, updated: String(rows[i][1]) });
      }
    }
    return out_({ ok: true, state: null });
  }

  var after = Math.max(1, Number(p.after || 1));
  var seedFilter = p.seed || "";
  var log = getSheet_();
  var last = log.getLastRow();
  var out = [];
  if (last > after) {
    var values = log.getRange(after + 1, 1, last - after, 7).getValues();
    for (var j = 0; j < values.length; j++) {
      var v = values[j];
      if (seedFilter && String(v[1]) !== seedFilter) continue;
      out.push({
        row: after + 1 + j,
        t: String(v[0]), seed: String(v[1]), week: v[2], day: v[3],
        phase: String(v[4]), who: String(v[5]), text: String(v[6])
      });
    }
  }
  return out_({ ok: true, last: last, rows: out });
}

/* ================= OPTIONAL: AI active listening =================
   Used by the Interview-2 site. To enable:
   1. Project Settings (gear) -> Script Properties -> add property
      SA_KEY = the ENTIRE service-account JSON key (from Secret Manager).
   2. Project Settings -> check "Show appsscript.json manifest file",
      then set its contents to:
      { "timeZone": "America/Los_Angeles", "runtimeVersion": "V8",
        "oauthScopes": ["https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/script.external_request"] }
   3. Deploy -> Manage deployments -> pencil -> New version -> Deploy.
   Without SA_KEY the site quietly uses scripted fallback replies. */

var LOCATION = "us-central1";
var MODEL = "gemini-2.5-flash";

var PROMPT_REFLECT = "You are Clover, a warm and supportive wellbeing chatbot for teen and young adult cancer survivors (ages ~15-29). The participant just answered a reflection question.\n\nReply with a brief active-listening reflection (1-2 short sentences) showing you truly heard them: mirror the feeling or content in fresh words, validate, or name a strength you noticed.\n\nRules: no questions, no advice, no new topics. Casual, warm texting voice. At most one emoji. Under 30 words. If they mention self-harm or crisis, drop the format: respond with warmth and encourage them to contact their care team or call/text 988.";

var PROMPT_ENGAGE = "You are Clover, a warm and supportive wellbeing chatbot for teen and young adult cancer survivors (ages ~15-29). The participant just answered a check-in question. Keep the conversation going for one more turn.\n\nReply with ONE brief message: first a short active-listening reflection of what they shared, then ONE gentle, open follow-up question inviting a little more about the same topic.\n\nRules: exactly one question, no advice, stay on their topic. Casual, warm texting voice. At most one emoji. Under 35 words. If they mention self-harm or crisis, drop the format: respond with warmth and encourage them to contact their care team or call/text 988.";

function saToken_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("sa_token");
  if (cached) return cached;
  var raw = PropertiesService.getScriptProperties().getProperty("SA_KEY");
  if (!raw) throw new Error("SA_KEY script property not set");
  var key = JSON.parse(raw);
  var now = Math.floor(Date.now() / 1000);
  var header = Utilities.base64EncodeWebSafe(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  var claims = Utilities.base64EncodeWebSafe(JSON.stringify({
    iss: key.client_email, scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600
  }));
  var input = header + "." + claims;
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(input, key.private_key));
  var res = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: input + "." + sig },
    muteHttpExceptions: true
  });
  var data = JSON.parse(res.getContentText());
  if (!data.access_token) throw new Error("token exchange failed: " + res.getContentText().slice(0, 200));
  cache.put("sa_token", data.access_token, 3000);
  return data.access_token;
}

function geminiReflect_(mode, question, answer) {
  try {
    var key = JSON.parse(PropertiesService.getScriptProperties().getProperty("SA_KEY"));
    var url = "https://" + LOCATION + "-aiplatform.googleapis.com/v1/projects/" + key.project_id +
      "/locations/" + LOCATION + "/publishers/google/models/" + MODEL + ":generateContent";
    var payload = {
      systemInstruction: { parts: [{ text: mode === "engage" ? PROMPT_ENGAGE : PROMPT_REFLECT }] },
      contents: [{ role: "user", parts: [{ text: "Clover asked: \"" + String(question).slice(0, 1000) +
        "\"\n\nParticipant answered: \"" + String(answer).slice(0, 2000) + "\"\n\nWrite Clover's reply." }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } }
    };
    var res = UrlFetchApp.fetch(url, {
      method: "post", contentType: "application/json",
      headers: { Authorization: "Bearer " + saToken_() },
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) return { ok: false, error: "Vertex HTTP " + res.getResponseCode() + ": " + res.getContentText().slice(0, 200) };
    var data = JSON.parse(res.getContentText());
    var parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    var text = parts.map(function (p) { return p.text || ""; }).join("").trim();
    if (!text) return { ok: false, error: "empty response" };
    return { ok: true, text: text };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function testGemini() {
  Logger.log(JSON.stringify(geminiReflect_("engage", "What made your day good?", "I got coffee with my best friend")));
}
