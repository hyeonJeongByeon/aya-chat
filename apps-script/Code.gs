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
