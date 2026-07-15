/**
 * AYA-CHAT Clover — remote logging endpoint (Google Apps Script)
 *
 * SETUP (one time, ~5 minutes):
 *  1. Go to sheets.google.com with your study Google account and create a
 *     blank spreadsheet named e.g. "Clover Interview Logs".
 *  2. In the sheet: Extensions -> Apps Script. Delete any code there and
 *     paste this entire file.
 *  3. Click Deploy -> New deployment -> type: Web app.
 *       - Description: clover log
 *       - Execute as: Me
 *       - Who has access: Anyone
 *     Click Deploy, authorize when asked, and COPY the Web app URL
 *     (looks like https://script.google.com/macros/s/XXXXX/exec).
 *  4. Paste that URL into the "Live log URL" field in the ⚙️ setup panel of
 *     the week pages, and into monitor.html.
 *
 * Every chat message becomes one row in the "log" sheet:
 *   ts | seed | week | day | phase | who | text
 */

var SHEET_NAME = "log";

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
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var d = JSON.parse(e.postData.contents);
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
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, row: sh.getLastRow() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * GET ?after=<rowNumber>&seed=<optional filter>
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
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, last: last, rows: rows }))
    .setMimeType(ContentService.MimeType.JSON);
}
