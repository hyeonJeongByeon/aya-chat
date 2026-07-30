/* AYA-CHAT Clover engine v3 — participant interview version.
   - One page per participant (window.CLOVER_PID), full 28-day program.
   - Resumes exactly where the participant left off, replaying the previous
     conversation like reopening a messages app.
   - Fully scripted (no AI). Deep-day + audio-triple scheduling per the
     7.27 rules. Optional Apps Script backend for central chat logs and
     cross-device resume.
*/
(function () {
  const C = window.CLOVER3;
  const PID = String(window.CLOVER_PID || "test");
  const BASE = window.CLOVER_BASE || "";

  /* ================= Seeded RNG ================= */
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ================= Persistent state ================= */
  const urlParams = new URLSearchParams(location.search);
  const K = (name) => "clover3-" + name + "-" + PID;
  const CONFIG_KEY = "clover3-config";

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }

  let settings = loadJSON(K("settings"), {
    interests: [], cancerOK: false, values: [],
    checkinTime: "", deepDays: [], voice: "Cathy", onboarded: false
  });
  function saveSettings() { localStorage.setItem(K("settings"), JSON.stringify(settings)); }

  let progress = Number(localStorage.getItem(K("progress")) || 0); // completed days

  let config = loadJSON(CONFIG_KEY, { logUrl: "", offline: false });
  function saveConfig() { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); }
  if (urlParams.get("log")) config.logUrl = urlParams.get("log");
  else if (!config.logUrl && window.CLOVER_DEFAULT_LOG_URL) config.logUrl = window.CLOVER_DEFAULT_LOG_URL;

  /* ================= Schedule =================
     Weeks run Mon(0)..Sun(6). Day 28 = Sunday = Final Reflection.
     Meaning lands on the participant's two chosen deep weekdays
     (week 1 uses only one). Audio (2 mindfulness + 1 MBSC per week,
     1+1 in week 4) sits on an every-other-day weekday triple that never
     touches the deep days — so audio days are never consecutive, even
     across week boundaries. */
  const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const TRIPLES = [[0, 2, 4], [1, 3, 5], [2, 4, 6], [0, 3, 5], [1, 4, 6], [0, 2, 5], [1, 3, 6]];

  function resolveDeepDays(rng) {
    let dd = (settings.deepDays || []).slice(0, 2);
    while (dd.length < 2) {
      const cand = Math.floor(rng() * 7);
      if (!dd.includes(cand)) dd.push(cand);
    }
    return dd.sort((a, b) => a - b);
  }

  function buildSchedule() {
    const rng = mulberry32(hashStr("clover3-" + PID));
    const deep = resolveDeepDays(rng);
    const sundayChosen = deep.includes(6);

    const validTriples = TRIPLES.filter((t) => !t.includes(deep[0]) && !t.includes(deep[1]));
    let triple = validTriples.find((t) => t[0] === 1 && t[1] === 3 && t[2] === 5) ||
      validTriples[Math.floor(rng() * validTriples.length)];
    triple = triple.slice().sort((a, b) => a - b);

    // Meaning slots per week (slot = weekday index 0-6).
    const meaningByWeek = [];
    if (sundayChosen) {
      const other = deep.find((d) => d !== 6);
      for (let w = 0; w < 4; w++) meaningByWeek.push([other, 6].sort((a, b) => a - b));
    } else {
      const w1pick = deep[Math.floor(rng() * 2)];
      meaningByWeek.push([w1pick]);
      meaningByWeek.push(deep.slice());
      meaningByWeek.push(deep.slice());
      meaningByWeek.push(deep.concat([6]).sort((a, b) => a - b));
    }

    // Meaning content sequence, chronological across the whole program.
    const meaningSeq = [
      C.meaning.find((m) => m.week === 1 && m.n === 1),
      C.meaning.find((m) => m.week === 2 && m.n === 1),
      C.meaning.find((m) => m.week === 2 && m.n === 2),
      C.meaning.find((m) => m.week === 3 && m.n === 1),
      C.meaning.find((m) => m.week === 3 && m.n === 2),
      C.meaning.find((m) => m.week === 4 && m.n === 1),
      C.meaning.find((m) => m.week === 4 && m.n === 2)
    ];
    const finalRef = C.meaning.find((m) => m.week === 4 && m.n === 3);

    // Written (savoring/gratitude) multiset per week.
    const writtenByWeek = sundayChosen
      ? [["sav", "gr"], ["sav", "gr"], ["sav", "gr"], ["gr", "gr", "sav"]]
      : [["sav", "sav", "gr"], ["sav", "gr"], ["sav", "gr"], ["gr", "gr"]];

    // Savoring/gratitude content queues, chronological.
    const savQ = [
      C.savoring.find((x) => x.week === 1 && x.n === 1),
      C.savoring.find((x) => x.week === 1 && x.n === 2),
      C.savoring.find((x) => x.week === 2 && x.n === 1),
      C.savoring.find((x) => x.week === 3 && x.n === 1)
    ];
    const grQ = [
      C.gratitude.find((x) => x.week === 1 && x.n === 1),
      C.gratitude.find((x) => x.week === 2 && x.n === 1),
      C.gratitude.find((x) => x.week === 3 && x.n === 1),
      C.gratitude.find((x) => x.week === 4 && x.n === 1),
      C.gratitude.find((x) => x.week === 4 && x.n === 2)
    ];
    const mfQ = [
      C.mindfulness.find((x) => x.week === 1 && x.n === 1),
      C.mindfulness.find((x) => x.week === 1 && x.n === 2),
      C.mindfulness.find((x) => x.week === 2 && x.n === 1),
      C.mindfulness.find((x) => x.week === 2 && x.n === 2),
      C.mindfulness.find((x) => x.week === 3 && x.n === 1),
      C.mindfulness.find((x) => x.week === 3 && x.n === 2),
      C.mindfulness.find((x) => x.week === 4 && x.n === 1)
    ];
    const mbQ = [1, 2, 3, 4].map((w) => C.mbsc.find((x) => x.week === w));

    const greet = shuffled(C.greetings, rng).concat(shuffled(C.greetings, rng));
    const metaOrders = [0, 1, 2, 3].map(() => shuffled(C.moodMetaphors, rng));

    // Tailored BA substitution, spread across days 2-27.
    const tailored = (settings.interests || []).map((i) => C.baTailored[i]).filter(Boolean);
    const baByDay = C.baGeneric.slice();
    if (tailored.length) {
      const gap = Math.max(2, Math.floor(26 / tailored.length));
      tailored.forEach((t, i) => {
        const d = 1 + (i + 1) * gap;
        if (d < 27) baByDay[d] = t;
      });
    }

    let meaningIdx = 0, savIdx = 0, grIdx = 0, mfIdx = 0, mbIdx = 0;
    const days = [];

    for (let w = 0; w < 4; w++) {
      const mSlots = meaningByWeek[w];
      const audioSlots = w === 3 ? triple.slice(0, 2) : triple;
      const taken = new Set(mSlots.concat(audioSlots));
      const freeSlots = [0, 1, 2, 3, 4, 5, 6].filter((s) => !taken.has(s));
      const written = shuffled(writtenByWeek[w], rng);
      const catBySlot = {};

      mSlots.forEach((s) => { catBySlot[s] = "mn"; });
      audioSlots.forEach((s, i) => { catBySlot[s] = (w === 3 ? ["mf", "mb"] : ["mf", "mb", "mf"])[i]; });
      freeSlots.forEach((s, i) => { catBySlot[s] = written[i]; });

      for (let s = 0; s < 7; s++) {
        const d = w * 7 + s;
        const cat = catBySlot[s];
        let exercise = null, isFinal = false;

        if (cat === "mn") {
          if (d === 27) { exercise = finalRef; isFinal = true; }
          else {
            const m = meaningSeq[meaningIdx++];
            exercise = { week: m.week, n: m.n, def: m.def, swap: m.swap };
            if (settings.cancerOK && m.n === 1) {
              const ca = C.cancer.find((x) => x.week === m.week);
              exercise = { week: m.week, n: 1, def: ca.steps, swap: m.def, cancer: true };
            }
          }
        }
        else if (cat === "sav") exercise = savQ[savIdx++];
        else if (cat === "gr") exercise = grQ[grIdx++];
        else if (cat === "mf") exercise = mfQ[mfIdx++];
        else if (cat === "mb") exercise = mbQ[mbIdx++];

        days.push({
          day: d + 1, week: w + 1, weekday: WEEKDAYS[s], cat,
          exercise, final: isFinal,
          funFact: C.funFacts[d],
          badge: d < 27 ? C.badges[d] : null,
          ba: baByDay[d],
          greeting: greet[d],
          metaphor: metaOrders[w][s]
        });
      }
    }
    return days;
  }

  /* ================= Logging + backend sync ================= */
  let transcript = loadJSON(K("transcript"), []);

  function log(who, text, phase) {
    const entry = {
      t: new Date().toISOString(), seed: PID,
      week: Math.ceil(state.dayNum / 7) || 0,
      day: state.dayNum, phase: phase || state.phase, who, text
    };
    transcript.push(entry);
    localStorage.setItem(K("transcript"), JSON.stringify(transcript));
    remoteLog(entry);
  }

  const remoteQueue = [];
  let remotePumping = false;
  function remoteLog(entry) {
    if (!config.logUrl || config.offline) return;
    remoteQueue.push(Object.assign({ action: "log" }, entry));
    pumpRemote();
  }
  async function pumpRemote() {
    if (remotePumping) return;
    remotePumping = true;
    while (remoteQueue.length) {
      const e = remoteQueue.shift();
      try { await fetch(config.logUrl, { method: "POST", body: JSON.stringify(e) }); }
      catch (err) { console.warn("remote log failed:", err); }
    }
    remotePumping = false;
  }

  async function saveStateRemote() {
    if (!config.logUrl || config.offline) return;
    try {
      await fetch(config.logUrl, {
        method: "POST",
        body: JSON.stringify({ action: "stateSave", pid: PID, state: { settings, progress } })
      });
    } catch (e) { console.warn("state save failed:", e); }
  }

  /* Cross-device backup: if this browser has nothing but a backend is
     configured, pull settings/progress/transcript from the sheet. */
  async function restoreFromRemote() {
    if (!config.logUrl || config.offline) return false;
    if (settings.onboarded || transcript.length) return false;
    try {
      const res = await fetch(config.logUrl + (config.logUrl.includes("?") ? "&" : "?") +
        "action=state&pid=" + encodeURIComponent(PID));
      const data = await res.json();
      if (data.ok && data.state && data.state.settings && data.state.settings.onboarded) {
        settings = data.state.settings;
        progress = Number(data.state.progress || 0);
        saveSettings();
        localStorage.setItem(K("progress"), String(progress));
        const res2 = await fetch(config.logUrl + (config.logUrl.includes("?") ? "&" : "?") +
          "after=1&seed=" + encodeURIComponent(PID));
        const data2 = await res2.json();
        if (data2.ok && data2.rows) {
          transcript = data2.rows.map((r) => ({ t: r.t, seed: r.seed, week: r.week, day: r.day, phase: r.phase, who: r.who, text: r.text }));
          localStorage.setItem(K("transcript"), JSON.stringify(transcript));
        }
        return true;
      }
    } catch (e) { console.warn("remote restore failed:", e); }
    return false;
  }

  function downloadTranscript() {
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify({ pid: PID, settings, progress, transcript }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "chatlog_" + PID + "_" + stamp + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
    // CSV too — easy to read in Excel/Sheets.
    const q = (x) => '"' + String(x).replaceAll('"', '""') + '"';
    const lines = ["timestamp,pid,week,day,phase,who,text"];
    transcript.forEach((r) => lines.push([r.t, r.seed, r.week, r.day, r.phase, r.who, r.text].map(q).join(",")));
    const blob2 = new Blob([lines.join("\n")], { type: "text/csv" });
    const a2 = document.createElement("a");
    a2.href = URL.createObjectURL(blob2);
    a2.download = "chatlog_" + PID + "_" + stamp + ".csv";
    a2.click();
    URL.revokeObjectURL(a2.href);
  }

  /* ================= Chat UI ================= */
  const messagesArea = document.getElementById("messagesArea");
  const inputField = document.getElementById("inputField");
  const sendBtn = document.getElementById("sendBtn");
  const chatForm = document.getElementById("chatForm");
  const statusTime = document.getElementById("statusTime");
  const dateSep = document.getElementById("dateSep");
  const chipsBar = document.getElementById("chipsBar");

  const state = { dayNum: 0, phase: "boot", lastCloverRow: null, pendingInput: null, pendingTimer: null, replaying: false };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function scrollToBottom() {
    requestAnimationFrame(() => { messagesArea.scrollTop = messagesArea.scrollHeight; });
    setTimeout(() => { messagesArea.scrollTop = messagesArea.scrollHeight; }, 320);
  }

  function updateStatusTime() {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(now);
    statusTime.textContent = fmt.replace(/\s?[AP]M$/, "");
    dateSep.textContent = "Today " + fmt;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function addTypingIndicator() {
    const row = document.createElement("div");
    row.className = "message-row received typing-row";
    row.innerHTML = '<div class="typing-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
    messagesArea.appendChild(row);
    scrollToBottom();
    return row;
  }

  function renderMessage(text, side, extraClass) {
    const row = document.createElement("div");
    row.className = "message-row " + (side === "sent" ? "sent" : "received");
    row.innerHTML = '<div class="bubble ' + (side === "sent" ? "sent" : "received") + (extraClass ? " " + extraClass : "") + '">' + escapeHtml(text) + "</div>";
    messagesArea.appendChild(row);
    if (side !== "sent") state.lastCloverRow = row;
    return row;
  }

  function addMessage(text, side, extraClass) {
    renderMessage(text, side, extraClass);
    scrollToBottom();
    log(side === "sent" ? "participant" : "clover", text);
  }

  function renderBadge(text) {
    // Never let the trailing emoji wrap onto its own line.
    const glued = String(text).replace(/ (\S+)$/, "\u00A0$1");
    const row = document.createElement("div");
    row.className = "message-row received";
    row.innerHTML = '<div class="bubble received badge-card"><span class="badge-label">🏆 Badge Awarded</span>' + escapeHtml(glued) + "</div>";
    messagesArea.appendChild(row);
    return row;
  }

  function addBadge(text) {
    renderBadge(text);
    scrollToBottom();
    log("clover", "[BADGE] " + text);
  }

  function renderSeparator(label) {
    const div = document.createElement("div");
    div.className = "date-sep";
    div.textContent = label;
    messagesArea.appendChild(div);
    return div;
  }

  function addSeparator(label) {
    renderSeparator(label);
    scrollToBottom();
    log("clover", "[HEADER] " + label);
  }

  function addTapbackToLast(emoji) {
    if (!state.lastCloverRow) return;
    const tb = document.createElement("div");
    tb.className = "tapback";
    tb.textContent = emoji;
    state.lastCloverRow.querySelector(".bubble").appendChild(tb);
    log("participant", "[TAPBACK] " + emoji);
  }

  function renderAudio(src, caption) {
    const row = document.createElement("div");
    row.className = "message-row received";
    row.innerHTML = '<div class="bubble received audio-bubble">'
      + '<span class="audio-caption">' + escapeHtml(caption) + "</span>"
      + '<audio controls preload="metadata" src="' + src + '"></audio></div>';
    messagesArea.appendChild(row);
    state.lastCloverRow = row;
    const audio = row.querySelector("audio");
    audio.addEventListener("error", () => {
      row.querySelector(".bubble").innerHTML =
        '<span class="audio-caption">' + escapeHtml(caption) + "</span>🎧 (Audio unavailable)";
    });
    return audio;
  }

  function addAudioMessage(audioKey, caption) {
    const voice = (settings.voice || "Cathy").toLowerCase();
    const src = BASE + "assets/audio2/" + audioKey + "-" + voice + ".mp3";
    const audio = renderAudio(src, caption);
    scrollToBottom();
    log("clover", "[AUDIO] " + audioKey + "-" + voice + ".mp3");
    return audio;
  }

  /* Replay a saved transcript instantly (reopening the messages app). */
  function replayTranscript() {
    state.replaying = true;
    for (const e of transcript) {
      const txt = String(e.text);
      if (e.who === "participant") {
        if (txt.startsWith("[TAPBACK] ")) {
          if (state.lastCloverRow) {
            const tb = document.createElement("div");
            tb.className = "tapback";
            tb.textContent = txt.slice(10);
            state.lastCloverRow.querySelector(".bubble").appendChild(tb);
          }
        } else renderMessage(txt, "sent");
      } else {
        if (txt.startsWith("[HEADER] ")) renderSeparator(txt.slice(9));
        else if (txt.startsWith("[BADGE] ")) renderBadge(txt.slice(8));
        else if (txt.startsWith("[AUDIO] ")) {
          const file = txt.slice(8);
          renderAudio(BASE + "assets/audio2/" + file, "Guided audio exercise");
        }
        else if (txt.startsWith("[")) { /* internal markers — skip */ }
        else renderMessage(txt, "received");
      }
    }
    state.replaying = false;
    scrollToBottom();
  }

  function updateInputState(enabled) {
    inputField.disabled = !enabled;
    sendBtn.classList.toggle("active", enabled && inputField.value.trim().length > 0);
  }

  function autosizeInput() {
    inputField.style.height = "auto";
    inputField.style.height = Math.min(inputField.scrollHeight, 96) + "px";
    sendBtn.classList.toggle("active", !inputField.disabled && inputField.value.trim().length > 0);
  }

  async function say(text, opts = {}) {
    const typing = addTypingIndicator();
    await wait(opts.typingMs ?? Math.min(900 + text.length * 12, 3000));
    typing.remove();
    addMessage(text, "received", opts.extraClass);
    await wait(opts.afterMs ?? 500);
  }

  async function pauseBeat(sec) {
    const typing = addTypingIndicator();
    await wait(sec * 1000);
    typing.remove();
  }

  function waitForUser(chips, opts = {}) {
    return new Promise((resolve) => {
      const done = (val) => {
        if (state.pendingTimer) { clearTimeout(state.pendingTimer); state.pendingTimer = null; }
        state.pendingInput = null;
        chipsBar.innerHTML = "";
        updateInputState(false);
        resolve(val);
      };
      state.pendingInput = done;
      renderChips(chips || [], done);
      updateInputState(true);
      inputField.focus();
      if (opts.timeoutMs) {
        state.pendingTimer = setTimeout(() => done({ timeout: true, text: "" }), opts.timeoutMs);
      }
    });
  }

  function renderChips(chips, done) {
    chipsBar.innerHTML = "";
    chips.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (c.reaction ? " reaction" : "");
      btn.textContent = c.label;
      btn.addEventListener("click", () => {
        if (!state.pendingInput) return;
        if (c.onTap) { c.onTap(btn); return; }
        if (c.reaction) addTapbackToLast(c.label);
        else if (!c.silent) addMessage(c.label, "sent");
        done({ text: c.value ?? c.label, chip: true, reaction: !!c.reaction });
      });
      chipsBar.appendChild(btn);
    });
    scrollToBottom();
  }

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = inputField.value.trim();
    if (!text || !state.pendingInput) return;
    addMessage(text, "sent");
    inputField.value = "";
    autosizeInput();
    state.pendingInput({ text, chip: false });
  });

  inputField.addEventListener("input", autosizeInput);
  inputField.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); chatForm.requestSubmit(); }
  });

  /* ================= Helpers ================= */
  const SWAP_CUES = ["swap", "different question", "something else", "another question",
    "skip", "switch", "don't want", "do not want", "dont want", "not in the mood",
    "rather not", "not talk about", "uncomfortable", "pass", "text version", "text instead",
    "rather read", "read it", "rather a text", "no audio", "prefer text", "prefer a text"];
  function wantsSwap(text) {
    const n = String(text).toLowerCase();
    return SWAP_CUES.some((c) => n.includes(c));
  }

  const RISK_PATTERNS = [
    /kill(ing)?\s+(myself|me)/, /suicid/, /end(ing)?\s+my\s+life/,
    /want(ed)?\s+to\s+die/, /wanna\s+die/, /rather\s+be\s+dead/,
    /hurt(ing)?\s+myself/, /harm(ing)?\s+myself/, /self[\s-]?harm/,
    /cut(ting)?\s+myself/, /overdos/, /don'?t\s+want\s+to\s+(be\s+alive|live)/,
    /not\s+want\s+to\s+live/, /better\s+off\s+dead/, /end\s+it\s+all/,
    /no\s+reason\s+to\s+live/, /take\s+my\s+(own\s+)?life/
  ];
  function checkRisk(text) {
    const n = String(text).toLowerCase();
    return RISK_PATTERNS.some((re) => re.test(n)) || C.riskKeywords.some((k) => n.includes(k));
  }
  async function maybeRisk(text) {
    if (!text || !checkRisk(text)) return false;
    log("clover", "[RISK DETECTED]");
    await say(C.riskResponse, { typingMs: 1200 });
    return true;
  }

  function fillValues(text) {
    const v = settings.values || [];
    return String(text)
      .replaceAll("{V1}", v[0] || "Self-Growth")
      .replaceAll("{V2}", v[1] || "Feeling Hopeful")
      .replaceAll("{V3}", v[2] || "Authenticity");
  }

  function classifyMood(text, metaphor) {
    const n = String(text).toLowerCase();
    for (const o of metaphor.options) {
      if (o.k.some((k) => n.includes(k))) return o.v;
    }
    if (C.moodWordsNeg.some((w) => n.includes(w))) return "kneg";
    if (C.moodWordsPos.some((w) => n.includes(w))) return "kpos";
    return "neu";
  }

  const NOT_DONE = ["no", "not yet", "didn't", "didnt", "did not", "forgot", "couldn't", "couldnt", "nope", "haven't", "havent", "no time"];
  function saysNotDone(text) {
    const n = String(text).toLowerCase().trim();
    return NOT_DONE.some((w) => n === w || n.startsWith(w + " ") || n.startsWith(w + ",") || n.includes(" " + w + " ") || n.endsWith(" " + w));
  }

  /* Run scripted steps (no AI — the next scripted line always responds). */
  async function runSteps(steps, allowSwap) {
    let questionAsked = false;
    for (const step of steps) {
      if (typeof step === "string") { await say(fillValues(step)); continue; }
      if (step.pause) { await pauseBeat(step.pause); continue; }

      const q = fillValues(step.ask || step.askNR);
      await say(q);

      let chips = [];
      if (allowSwap && !questionAsked) {
        await say(pick(C.swapReminders), { typingMs: 800 });
        chips = [{ label: "🔄 Swap question", value: "__swap__" }];
      }

      const reply = await waitForUser(chips);
      if (allowSwap && !questionAsked && (reply.text === "__swap__" || wantsSwap(reply.text))) {
        return "swapped";
      }
      questionAsked = true;
      await maybeRisk(reply.text);
    }
    return "done";
  }

  const REACTION_CHIPS = [
    { label: "👍", reaction: true }, { label: "❤️", reaction: true },
    { label: "😂", reaction: true }, { label: "‼️", reaction: true }, { label: "😮", reaction: true }
  ];

  async function runAudioIntervention(dayInfo) {
    const ex = dayInfo.exercise;
    const isMf = dayInfo.cat === "mf";
    const pre = C.mindfulnessPre.replaceAll("{NAME}", settings.voice || "Cathy");
    log("clover", "[INTERVENTION " + dayInfo.cat + " W" + ex.week + " audio=" + ex.audioKey + "]");

    await say(pre);
    const audio = addAudioMessage(ex.audioKey, isMf ? "Guided mindfulness: " + ex.title : "Guided self-compassion exercise");
    await wait(400);

    let resolved = false;
    const listenPromise = new Promise((resolve) => {
      audio.addEventListener("ended", () => { if (!resolved) resolve({ text: "__finished__" }); });
    });
    const inputPromise = waitForUser([
      { label: "✅ I finished the exercise", value: "__finished__" },
      { label: "📖 Text version instead", value: "__swap__" }
    ]);
    const reply = await Promise.race([listenPromise, inputPromise]);
    resolved = true;
    if (state.pendingInput) state.pendingInput({ text: "__finished__", silent: true });

    if (reply.text === "__swap__" || (reply.text !== "__finished__" && wantsSwap(reply.text))) {
      await say("Of course! Here's a text version 😊", { typingMs: 800 });
      log("clover", "[SWAPPED to text version]");
      await runSteps(ex.text, false);
      return;
    }
    if (reply.text && reply.text !== "__finished__") await maybeRisk(reply.text);

    // Post-audio tapback; the next message shows up regardless (10s window).
    await say(pick(C.audioTapbacks), { typingMs: 800 });
    await waitForUser(REACTION_CHIPS, { timeoutMs: 10000 });
    await wait(300);

    // Green ✨ affirmation sent as text after the tapback.
    let green = ex.green;
    if (!green) {
      // MBSC: use the exercise's ✨ closing line.
      const closings = ex.text.filter((s) => typeof s === "string" && s.startsWith("✨"));
      green = closings[closings.length - 1] || "✨ Thank you for taking this moment for yourself.";
    }
    await say(green, { typingMs: 900 });
  }

  /* ================= Daily flow ================= */
  async function runDay(dayInfo, prevDay) {
    state.dayNum = dayInfo.day;
    addSeparator("Day " + dayInfo.day);

    // 1. Greeting
    state.phase = "greeting";
    await say(dayInfo.greeting);

    // 2. Mood monitoring: follow-up (pos/neg) then acknowledgment for all.
    state.phase = "mood";
    const m = dayInfo.metaphor;
    await say("How are you feeling today?\n\n" + m.options.map((o) => o.t + " – " + o.d).join("\n"));
    const moodReply = await waitForUser(m.options.map((o) => ({ label: o.t, value: o.t })));
    await maybeRisk(moodReply.text);
    const mood = classifyMood(moodReply.text, m);
    log("clover", "[MOOD=" + mood + "]");

    if (mood === "pos" || mood === "kpos") {
      await say(pick(C.moodFollowPos));
      const r = await waitForUser();
      await maybeRisk(r.text);
      await say(pick(C.ackPos));
    } else if (mood === "neg" || mood === "kneg") {
      await say(pick(C.moodFollowNeg));
      const r = await waitForUser();
      await maybeRisk(r.text);
      await say(pick(C.ackNeg));
    } else {
      await say(pick(C.ackNeu));
    }

    // 3. Challenge check-in (yesterday's challenge)
    if (prevDay && prevDay.ba && prevDay.ba.checkin) {
      state.phase = "ba-checkin";
      addSeparator("💪 Challenge Check-In");
      await say(prevDay.ba.checkin);
      const r = await waitForUser();
      const risky = await maybeRisk(r.text);
      if (!risky) await say(saysNotDone(r.text) ? prevDay.ba.notDone : prevDay.ba.done);
    }

    // 4. Fun fact, led by a mood-matched opener
    state.phase = "funfact";
    addSeparator("🤔 Fun Fact of the Day");
    const bucket = (mood === "pos" || mood === "kpos") ? "pos" : (mood === "neg" || mood === "kneg") ? "neg" : "neu";
    await say(pick(C.funFactOpeners[bucket]));
    const ff = dayInfo.funFact;
    if (ff.type === "s") {
      await say(ff.text);
      await say(pick(C.funFactTapbacks), { typingMs: 800 });
      await waitForUser(REACTION_CHIPS, { timeoutMs: 10000 });
      await wait(300);
    } else {
      await say(ff.q);
      const guess = await waitForUser();
      await maybeRisk(guess.text);
      await say(ff.a, { afterMs: 600 });
    }

    // 5. Exercise of the day
    state.phase = "intervention";
    addSeparator(dayInfo.final ? "🧘 Exercise of the Day 🍀" : "🧘 Exercise of the Day 💭");
    const ex = dayInfo.exercise;
    if (dayInfo.cat === "mf" || dayInfo.cat === "mb") {
      await runAudioIntervention(dayInfo);
    } else {
      log("clover", "[INTERVENTION " + dayInfo.cat + " W" + ex.week + "," + ex.n + (ex.cancer ? " CANCER" : "") + (dayInfo.final ? " FINAL" : "") + "]");
      const allowSwap = !!ex.swap && !dayInfo.final;
      const result = await runSteps(ex.def, allowSwap);
      if (result === "swapped") {
        await say("No problem at all! Let's try this one instead 😊", { typingMs: 800 });
        log("clover", "[SWAPPED]");
        await runSteps(ex.swap, false);
      }
    }

    // 6-7. Badge + streak
    state.phase = "badge";
    await wait(300);
    if (dayInfo.day === 28) {
      await say(C.day28BadgeIntro);
      addBadge(C.day28Badge);
    } else {
      addBadge("Day " + dayInfo.day + ": " + dayInfo.badge);
    }
    await wait(800);
    await say("Streak: " + dayInfo.day + " day" + (dayInfo.day > 1 ? "s" : "") + " 🔥", { typingMs: 600 });

    // 8. Daily challenge
    state.phase = "ba";
    await say(dayInfo.ba.ch);

    if (dayInfo.day === 28) {
      await say("Thank you for spending these 28 days with me. Take care of yourself — you've shown you know how. 💛🍀");
    }
  }

  /* ================= Onboarding ================= */
  async function runOnboarding() {
    state.phase = "onboarding";
    state.dayNum = 0;
    addSeparator("Getting to know you");

    await say(C.onboardingIntro, { typingMs: 2200 });

    // Interests
    await say("What are your interests? Tap all that apply, then hit Done!");
    const picked = [];
    await new Promise((resolve) => {
      const done = () => { state.pendingInput = null; chipsBar.innerHTML = ""; resolve(); };
      state.pendingInput = done;
      renderChips(C.interests.map((name) => ({
        label: name,
        onTap: (btn) => {
          btn.classList.toggle("selected");
          const i = picked.indexOf(name);
          if (i >= 0) picked.splice(i, 1); else picked.push(name);
        }
      })).concat([
        { label: "None of these", onTap: () => { picked.length = 0; addMessage("None of these", "sent"); done(); } },
        { label: "Done ✅", onTap: () => { addMessage(picked.length ? picked.join(", ") : "(none)", "sent"); done(); } }
      ]), done);
      updateInputState(false);
    });
    settings.interests = picked;
    await say(picked.length ? "Nice picks! I'll keep those in mind for your daily challenges ✨" : C.interestNoneAck);

    // Cancer question
    await say("Would you like Clover to ask you positive psychology exercises about your cancer experience?");
    let r = await waitForUser([{ label: "Yes", value: "yes" }, { label: "No", value: "no" }]);
    settings.cancerOK = /^y/i.test(r.text.trim());

    // Values
    await say("Which of these values are most important to you right now? Pick 3:\n\n" +
      C.values.map((v) => "• " + v.name + ": " + v.def).join("\n"));
    const vals = [];
    await new Promise((resolve) => {
      const done = () => { state.pendingInput = null; chipsBar.innerHTML = ""; resolve(); };
      state.pendingInput = done;
      renderChips(C.values.map((v) => ({
        label: v.name,
        onTap: (btn) => {
          if (btn.classList.contains("selected")) {
            btn.classList.remove("selected");
            vals.splice(vals.indexOf(v.name), 1);
          } else if (vals.length < 3) {
            btn.classList.add("selected");
            vals.push(v.name);
          }
          if (vals.length === 3) { addMessage(vals.join(", "), "sent"); done(); }
        }
      })), done);
      updateInputState(false);
    });
    settings.values = vals;

    // Check-in time
    await say("What time of day would you like Clover to check in with you?");
    r = await waitForUser([{ label: "Same time every day" }, { label: "Customize for each day of the week" }]);
    if (/same/i.test(r.text)) {
      await say("What time?");
      const t = await waitForUser();
      settings.checkinTime = "Every day at " + t.text;
    } else {
      await say("What time on each day? (You can type it like: Mon 6pm, Tue 7pm, Wed 6pm...)");
      const t = await waitForUser();
      settings.checkinTime = t.text;
    }

    // Deep question days
    await say("Which two days of the week would you like Clover to ask you to reflect on deep thinking positive psychology questions? (Either choose two days of the week or say \"surprise me\" if you don't have a preference)");
    const dd = [];
    await new Promise((resolve) => {
      const done = () => { state.pendingInput = null; chipsBar.innerHTML = ""; resolve(); };
      state.pendingInput = done;
      renderChips(WEEKDAYS.map((name, idx) => ({
        label: name,
        onTap: (btn) => {
          if (btn.classList.contains("selected")) {
            btn.classList.remove("selected");
            dd.splice(dd.indexOf(idx), 1);
          } else if (dd.length < 2) {
            btn.classList.add("selected");
            dd.push(idx);
          }
          if (dd.length === 2) {
            addMessage(dd.map((i) => WEEKDAYS[i]).join(" and "), "sent");
            done();
          }
        }
      })).concat([{ label: "Surprise me 🎁", onTap: () => {
        addMessage(dd.length ? dd.map((i) => WEEKDAYS[i]).join(" and ") + " and surprise me 🎁" : "Surprise me 🎁", "sent");
        done();
      } }]), done);
      updateInputState(false);
    });
    settings.deepDays = dd;

    // Voice choice with samples
    await say("Some of the exercises you will do are mindfulness audio exercises. Clover's helper, Cathy or Cody, will guide you through them. Choose the voice you'd like to hear for mindfulness exercises.");
    let previewAudio = null;
    const playPreview = (name) => {
      if (previewAudio) previewAudio.pause();
      previewAudio = new Audio(BASE + "assets/audio2/preview-" + name.toLowerCase() + ".mp3");
      previewAudio.play().catch(() => {});
    };
    r = await waitForUser([
      { label: "▶️ Hear Cathy", onTap: () => playPreview("Cathy") },
      { label: "▶️ Hear Cody", onTap: () => playPreview("Cody") },
      { label: "Cathy 🎙️", value: "Cathy" },
      { label: "Cody 🎙️", value: "Cody" }
    ]);
    if (previewAudio) previewAudio.pause();
    settings.voice = /cody/i.test(r.text) ? "Cody" : "Cathy";

    settings.onboarded = true;
    saveSettings();
    saveStateRemote();
    await say("That's everything — you're all set! 🎉");
  }

  /* ================= Main ================= */
  function dayButton(label) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "day-btn-wrap";
      const btn = document.createElement("button");
      btn.className = "day-btn";
      btn.textContent = label;
      btn.addEventListener("click", () => { wrap.remove(); resolve(); });
      wrap.appendChild(btn);
      messagesArea.appendChild(wrap);
      scrollToBottom();
    });
  }

  async function main() {
    updateStatusTime();
    setInterval(updateStatusTime, 30000);
    autosizeInput();
    updateInputState(false);
    document.getElementById("weekBadge").textContent = "Participant " + PID;

    await restoreFromRemote();

    // Reopen-the-app feel: replay everything so far, then continue.
    if (transcript.length) replayTranscript();

    await wait(400);

    if (!settings.onboarded) {
      await runOnboarding();
    }

    const schedule = buildSchedule();

    if (progress >= 28) {
      await say("You've completed the whole 28-day program! Thank you again 💛🍀");
      return;
    }

    for (let d = progress; d < 28; d++) {
      await dayButton((d === 0 ? "Start" : "Continue to") + " Day " + (d + 1) + " →");
      await runDay(schedule[d], d > 0 ? schedule[d - 1] : null);
      progress = d + 1;
      localStorage.setItem(K("progress"), String(progress));
      saveStateRemote();
    }
  }

  /* ================= Setup panel ================= */
  const overlay = document.getElementById("setupOverlay");
  const statusEl = document.getElementById("setupStatus");

  function openSetup() {
    document.getElementById("cfgLogUrl").value = config.logUrl || "";
    document.getElementById("cfgOffline").checked = config.offline;
    statusEl.textContent = "Participant " + PID + " — day progress: " + progress + "/28";
    statusEl.className = "setup-status";
    overlay.classList.add("open");
  }

  document.getElementById("setupGear").addEventListener("click", openSetup);
  document.getElementById("cfgClose").addEventListener("click", () => overlay.classList.remove("open"));
  document.getElementById("cfgSave").addEventListener("click", () => {
    config.logUrl = document.getElementById("cfgLogUrl").value.trim();
    config.offline = document.getElementById("cfgOffline").checked;
    saveConfig();
    statusEl.textContent = "Saved.";
    statusEl.className = "setup-status ok";
  });
  document.getElementById("cfgDownload").addEventListener("click", downloadTranscript);
  const importInput = document.getElementById("cfgImportFile");
  if (importInput) {
    document.getElementById("cfgImport").addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", () => {
      const file = importInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data.settings || !Array.isArray(data.transcript)) throw new Error("not a Clover chat log");
          if (data.pid && data.pid !== PID && !confirm("This log is for participant " + data.pid + " but this page is " + PID + ". Import anyway?")) return;
          localStorage.setItem(K("settings"), JSON.stringify(data.settings));
          localStorage.setItem(K("progress"), String(data.progress || 0));
          localStorage.setItem(K("transcript"), JSON.stringify(data.transcript));
          location.reload();
        } catch (e) {
          statusEl.textContent = "❌ Could not import: " + e.message + " (use the chatlog_..._.json file, not the .csv)";
          statusEl.className = "setup-status err";
        }
      };
      reader.readAsText(file);
    });
  }
  document.getElementById("cfgResetAll").addEventListener("click", () => {
    if (!confirm("Reset participant " + PID + " completely? Clears onboarding answers, progress, and the local chat history on this device.")) return;
    ["settings", "progress", "transcript"].forEach((n) => localStorage.removeItem(K(n)));
    location.reload();
  });

  if (urlParams.get("setup")) setTimeout(openSetup, 400);

  window.__cloverSchedule3 = buildSchedule;
  main();
})();
