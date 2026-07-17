/**
 * AYA-CHAT Clover — Apps Script backend
 * Does TWO jobs behind one URL, so the shared website needs no tokens:
 *   1. Persistent logging: every chat message -> a row in this spreadsheet.
 *   2. Gemini proxy: calls Vertex AI with YOUR Google account's credentials,
 *      which Google refreshes automatically — works whenever a participant
 *      opens the link, with no 1-hour token problem.
 *
 * SETUP (one time, ~10 minutes):
 *  1. sheets.google.com (Seattle Children's account) -> create a blank
 *     spreadsheet named e.g. "Clover Interview Logs".
 *  2. Extensions -> Apps Script. Delete the placeholder and paste this file.
 *  3. Fill in PROJECT_ID below with the real GCP project ID.
 *  4. Left sidebar: Project Settings (gear) -> check "Show appsscript.json
 *     manifest file". Back in the editor, open appsscript.json and replace
 *     its contents with:
 *
 *     {
 *       "timeZone": "America/Los_Angeles",
 *       "exceptionLogging": "STACKDRIVER",
 *       "runtimeVersion": "V8",
 *       "oauthScopes": [
 *         "https://www.googleapis.com/auth/spreadsheets",
 *         "https://www.googleapis.com/auth/script.external_request",
 *         "https://www.googleapis.com/auth/cloud-platform"
 *       ]
 *     }
 *
 *  5. Deploy -> New deployment -> type: Web app.
 *       Execute as: Me    |    Who has access: Anyone
 *     Authorize with your Seattle Children's account when prompted
 *     (that account must have Vertex AI access on the project).
 *  6. Copy the Web app URL (ends in /exec) and paste it into the
 *     "Apps Script URL" field in the ⚙️ panel of the site, and into
 *     monitor.html.
 *
 * To update this code later: paste changes, then Deploy -> Manage
 * deployments -> edit (pencil) -> Version: New version -> Deploy.
 * (Creating a brand-new deployment changes the URL; editing keeps it.)
 */

/* ======== CONFIG — EDIT THIS ======== */
var PROJECT_ID = "PASTE-YOUR-GCP-PROJECT-ID-HERE"; // exact ID, not display name
var LOCATION = "us-central1";
var MODEL = "gemini-2.5-flash";
/* ==================================== */

var SHEET_NAME = "log";

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
    sh.appendRow(["ts", "seed", "week", "day", "phase", "who", "text"]);
  }
  return sh;
}

function doPost(e) {
  var d;
  try {
    d = JSON.parse(e.postData.contents);
  } catch (err) {
    return out_({ ok: false, error: "bad JSON" });
  }

  if (d.action === "gemini") {
    return out_(geminiReflect_(String(d.question || ""), String(d.answer || "")));
  }

  // Default action: append a log row.
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = getSheet_();
    sh.appendRow([
      String(d.t || new Date().toISOString()),
      String(d.seed || ""),
      Number(d.week || 0),
      Number(d.day || 0),
      String(d.phase || ""),
      String(d.who || ""),
      String(d.text || "")
    ]);
    return out_({ ok: true, row: sh.getLastRow() });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function geminiReflect_(question, answer) {
  if (PROJECT_ID.indexOf("PASTE-") === 0) {
    return { ok: false, error: "PROJECT_ID not set in Apps Script Code.gs" };
  }
  var url = "https://" + LOCATION + "-aiplatform.googleapis.com/v1/projects/" +
    PROJECT_ID + "/locations/" + LOCATION +
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

  try {
    var res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    var bodyText = res.getContentText();
    if (code !== 200) {
      return { ok: false, error: "Vertex HTTP " + code + ": " + bodyText.slice(0, 300) };
    }
    var data = JSON.parse(bodyText);
    var parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    var text = parts.map(function (p) { return p.text || ""; }).join("").trim();
    if (!text) return { ok: false, error: "empty Vertex response" };
    return { ok: true, text: text };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * GET ?after=<rowNumber>&seed=<optional filter> — used by monitor.html.
 * Returns rows with row number > after (header is row 1).
 */
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

/** Run this from the editor (Run button) once to test your Vertex access. */
function testGemini() {
  var r = geminiReflect_("How are you feeling today?", "Pretty good, I spent time with my dog.");
  Logger.log(JSON.stringify(r));
}
