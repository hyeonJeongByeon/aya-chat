/* AYA-CHAT Clover engine v2 — interview + pilot (fixed 28-day schedule)
   Requires: window.CLOVER_WEEK (1-4), assets/content2.js loaded first.
   Flow per day (Daily Challenge Content Order 7.13):
   greeting -> mood (+AI) -> BA check-in -> fun fact -> intervention (+AI)
   -> affirmation -> badge + streak -> BA challenge.
*/
(function () {
  const C = window.CLOVER2;
  const WEEK = window.CLOVER_WEEK || 1;
  // Team-testing mode: name-first fresh session every load, week picker,
  // no persistence of settings/progress/transcripts between sessions.
  const TESTING = !!window.CLOVER_TESTING;
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
  const SETTINGS_KEY = "clover2-settings";
  const CONFIG_KEY = "clover2-config";

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }

  let settings = (TESTING ? null : loadJSON(SETTINGS_KEY, null)) || {
    pid: "", interests: [], cancerOK: false, values: [],
    checkinTime: "", deepDays: [], voice: "Cathy", onboarded: false
  };
  if (urlParams.get("p") && urlParams.get("p") !== settings.pid) {
    settings.pid = urlParams.get("p");
  }
  if (!settings.pid) settings.pid = "P" + Math.floor(Math.random() * 1e6);
  function saveSettings() { if (!TESTING) localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
  saveSettings();

  let config = loadJSON(CONFIG_KEY, { logUrl: "", offline: false });
  function saveConfig() { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); }
  if (urlParams.get("log")) config.logUrl = urlParams.get("log");
  else if (!config.logUrl && window.CLOVER_DEFAULT_LOG_URL) config.logUrl = window.CLOVER_DEFAULT_LOG_URL;

  /* ================= Schedule (fixed by doc labels) ================= */
  const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  function resolveDeepSlots(rng) {
    // settings.deepDays: array of weekday indices 0-6 (Mon=0), or empty = surprise me
    let dd = (settings.deepDays || []).slice(0, 2).sort((a, b) => a - b);
    while (dd.length < 2) {
      const cand = Math.floor(rng() * 7);
      if (!dd.includes(cand)) dd.push(cand);
      dd.sort((a, b) => a - b);
    }
    return dd; // 0-based slots within a week
  }

  function buildSchedule() {
    const rng = mulberry32(hashStr("clover2-" + settings.pid));
    const deep = resolveDeepSlots(rng);
    const days = new Array(28).fill(null);

    const catFill = {
      1: ["sav1", "sav2", "gr1", "mf1", "mf2", "mb1"],
      2: ["sav1", "gr1", "mf1", "mf2", "mb1"],
      3: ["sav1", "gr1", "mf1", "mf2", "mb1"],
      4: ["gr1", "gr2", "mf1", "mb1"]
    };

    for (let w = 1; w <= 4; w++) {
      const base = (w - 1) * 7;
      const slots = [0, 1, 2, 3, 4, 5, 6];
      const meaningSlots = [];

      if (w === 1) {
        meaningSlots.push(deep[Math.floor(rng() * 2)]);
      } else if (w === 4) {
        // Day 28 (slot 6) is always the Final Reflection.
        let cand = deep.filter((s) => s !== 6);
        while (cand.length < 2) {
          const c = Math.floor(rng() * 6);
          if (!cand.includes(c)) cand.push(c);
        }
        cand.sort((a, b) => a - b);
        meaningSlots.push(cand[0], cand[1]);
      } else {
        meaningSlots.push(deep[0], deep[1]);
      }

      const taken = new Set(meaningSlots);
      if (w === 4) taken.add(6);
      const freeSlots = shuffled(slots.filter((s) => !taken.has(s)), rng);

      // Meaning exercises by slot order.
      meaningSlots.sort((a, b) => a - b).forEach((slot, i) => {
        days[base + slot] = { cat: "mn", week: w, n: i + 1 };
      });
      if (w === 4) days[base + 6] = { cat: "mn", week: 4, n: 3, final: true };

      // Remaining categories: seeded placement, exercise # by slot order.
      const cats = catFill[w].slice();
      const placed = [];
      freeSlots.forEach((slot, i) => { placed.push({ slot, tag: cats[i] }); });
      // Re-number mf/sav/gr by chronological slot so "Mindfulness 1" comes first.
      ["sav", "gr", "mf", "mb"].forEach((c) => {
        const inWeek = placed.filter((p) => p.tag.startsWith(c)).sort((a, b) => a.slot - b.slot);
        inWeek.forEach((p, i) => { days[base + p.slot] = { cat: c, week: w, n: i + 1 }; });
      });
    }

    // Attach content + per-day extras.
    const greet = shuffled(C.greetings, rng).concat(shuffled(C.greetings, rng));
    const metaOrders = [0, 1, 2, 3].map(() => shuffled(C.moodMetaphors, rng));
    const affirmations = shuffled(C.affirmations, rng);

    // Tailored BA placement: spread the participant's interests across days 2-27.
    const tailored = (settings.interests || []).map((i) => C.baTailored[i]).filter(Boolean);
    const baByDay = C.baGeneric.slice();
    if (tailored.length) {
      const gap = Math.max(2, Math.floor(26 / tailored.length));
      tailored.forEach((t, i) => {
        const d = 1 + (i + 1) * gap; // day index (0-based), keeps day1 + day28 generic
        if (d < 27) baByDay[d] = t;
      });
    }

    for (let d = 0; d < 28; d++) {
      const info = days[d];
      const w = info.week;
      let exercise = null;

      if (info.cat === "sav") exercise = C.savoring.find((x) => x.week === w && x.n === info.n);
      else if (info.cat === "gr") exercise = C.gratitude.find((x) => x.week === w && x.n === info.n);
      else if (info.cat === "mn") {
        const m = C.meaning.find((x) => x.week === w && x.n === info.n);
        exercise = { week: w, n: info.n, def: m.def, swap: m.swap, final: !!m.final };
        if (settings.cancerOK && info.n === 1 && !m.final) {
          const ca = C.cancer.find((x) => x.week === w);
          exercise = { week: w, n: 1, def: ca.steps, swap: m.def, cancer: true };
        }
      }
      else if (info.cat === "mf") exercise = C.mindfulness.find((x) => x.week === w && x.n === info.n);
      else if (info.cat === "mb") exercise = C.mbsc.find((x) => x.week === w);

      Object.assign(info, {
        day: d + 1,
        exercise,
        funFact: C.funFacts[d],
        badge: d < 27 ? C.badges[d] : null,
        affirmation: affirmations[d % affirmations.length],
        ba: baByDay[d],
        greeting: greet[d],
        metaphor: metaOrders[w - 1][d % 7],
        rng: null
      });
    }
    return days;
  }

  /* ================= Logging ================= */
  const transcriptKey = "clover2-transcript-w" + WEEK + "-" + settings.pid;
  let transcript = loadJSON(transcriptKey, []);

  function log(who, text, phase) {
    const entry = {
      t: new Date().toISOString(), seed: settings.pid,
      week: TESTING ? (Math.ceil(state.dayNum / 7) || 0) : WEEK,
      day: state.dayNum, phase: phase || state.phase, who, text
    };
    transcript.push(entry);
    if (!TESTING) localStorage.setItem(transcriptKey, JSON.stringify(transcript));
    remoteLog(entry);
  }

  const remoteQueue = [];
  let remotePumping = false;
  function remoteLog(entry) {
    if (!config.logUrl) return;
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

  function downloadTranscript() {
    const blob = new Blob([JSON.stringify({ pid: settings.pid, settings, transcript }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "clover-w" + WEEK + "-" + settings.pid + "-" + Date.now() + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ================= Gemini via backend proxy ================= */
  let lastGeminiError = "";
  let fbIdx = Math.floor(Math.random() * C.fallbackReflections.length);
  function fallbackReflection() {
    fbIdx = (fbIdx + 1) % C.fallbackReflections.length;
    return C.fallbackReflections[fbIdx];
  }

  async function geminiReflect(question, answer) {
    if (config.offline || !config.logUrl) return fallbackReflection();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(config.logUrl, {
        method: "POST",
        body: JSON.stringify({ action: "gemini", question, answer }),
        signal: controller.signal
      });
      clearTimeout(timer);
      const data = await res.json();
      if (data.ok && data.text) { setGearStatus(""); return data.text.trim(); }
      throw new Error(data.error || "proxy error");
    } catch (e) {
      console.warn("Gemini proxy failed:", e);
      lastGeminiError = e.message || String(e);
      setGearStatus("⚠️ AI unavailable — using fallback replies");
      return fallbackReflection();
    }
  }

  /* ================= Chat UI ================= */
  const messagesArea = document.getElementById("messagesArea");
  const inputField = document.getElementById("inputField");
  const sendBtn = document.getElementById("sendBtn");
  const chatForm = document.getElementById("chatForm");
  const statusTime = document.getElementById("statusTime");
  const dateSep = document.getElementById("dateSep");
  const chipsBar = document.getElementById("chipsBar");

  const state = { dayNum: 0, phase: "boot", lastCloverRow: null, pendingInput: null, pendingTimer: null };
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

  function addMessage(text, side, extraClass) {
    const row = document.createElement("div");
    row.className = "message-row " + (side === "sent" ? "sent" : "received");
    row.innerHTML = '<div class="bubble ' + (side === "sent" ? "sent" : "received") + (extraClass ? " " + extraClass : "") + '">' + escapeHtml(text) + "</div>";
    messagesArea.appendChild(row);
    if (side !== "sent") state.lastCloverRow = row;
    scrollToBottom();
    log(side === "sent" ? "participant" : "clover", text);
    return row;
  }

  function addBadge(text) {
    const row = document.createElement("div");
    row.className = "message-row received";
    row.innerHTML = '<div class="bubble received badge-card"><span class="badge-label">🏆 Badge awarded</span>' + escapeHtml(text) + "</div>";
    messagesArea.appendChild(row);
    scrollToBottom();
    log("clover", "[BADGE] " + text);
  }

  function addSeparator(label) {
    const div = document.createElement("div");
    div.className = "date-sep";
    div.textContent = label;
    messagesArea.appendChild(div);
    scrollToBottom();
  }

  function addTapbackToLast(emoji) {
    if (!state.lastCloverRow) return;
    const tb = document.createElement("div");
    tb.className = "tapback";
    tb.textContent = emoji;
    state.lastCloverRow.querySelector(".bubble").appendChild(tb);
    log("participant", "[TAPBACK] " + emoji);
  }

  /* Audio bubble; falls back to a placeholder note if the mp3 is missing. */
  function addAudioMessage(audioKey, caption) {
    const voice = (settings.voice || "Cathy").toLowerCase();
    const src = BASE + "assets/audio2/" + audioKey + "-" + voice + ".mp3";
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
        '<span class="audio-caption">' + escapeHtml(caption) + "</span>🎧 (Audio coming soon — imagine a calm 2-minute guided exercise here!)";
    });
    scrollToBottom();
    log("clover", "[AUDIO] " + src);
    return audio;
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

  /* [Wait 10 seconds] — real 10s pause WITH the typing bubble visible. */
  async function pauseBeat(sec) {
    const typing = addTypingIndicator();
    await wait(sec * 1000);
    typing.remove();
  }

  /* Wait for input. opts.chips, opts.timeoutMs (resolves {timeout:true}). */
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
    "rather read", "read it", "rather a text", "no audio"];
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
    if (C.moodWordsNeu.some((w) => n.includes(w))) return "neu";
    return "neu";
  }

  const NOT_DONE = ["no", "not yet", "didn't", "didnt", "did not", "forgot", "couldn't", "couldnt", "nope", "haven't", "havent", "no time", "didn t"];
  function saysNotDone(text) {
    const n = String(text).toLowerCase().trim();
    return NOT_DONE.some((w) => n === w || n.startsWith(w + " ") || n.startsWith(w + ",") || n.includes(" " + w + " ") || n.endsWith(" " + w));
  }

  async function reflect(question, answerText) {
    const typing = addTypingIndicator();
    const r = await geminiReflect(question, answerText);
    typing.remove();
    addMessage(r, "received");
    log("clover", "[AI] " + r);
    await wait(500);
  }

  /* Run scripted steps. allowSwap: offer the swap reminder + chip after the
     first question; returns "swapped" if the participant switches. */
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

      const risky = await maybeRisk(reply.text);
      if (step.ask && !risky) await reflect(q, reply.text);
    }
    return "done";
  }

  const REACTION_CHIPS = [
    { label: "👍", reaction: true }, { label: "❤️", reaction: true },
    { label: "😂", reaction: true }, { label: "‼️", reaction: true }, { label: "😮", reaction: true }
  ];

  /* Audio-default intervention (mindfulness + MBSC). */
  async function runAudioIntervention(dayInfo) {
    const ex = dayInfo.exercise;
    const isMf = dayInfo.cat === "mf";
    const pre = (isMf ? C.mindfulnessPre : C.mbscPre).replaceAll("{NAME}", settings.voice || "Cathy");
    log("clover", "[INTERVENTION " + dayInfo.cat + " W" + dayInfo.week + " audio=" + ex.audioKey + "]");

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
  }

  /* ================= Daily flow ================= */
  async function runDay(dayInfo, prevDay) {
    state.dayNum = dayInfo.day;
    addSeparator("Day " + dayInfo.day);

    // 1. Greeting
    state.phase = "greeting";
    await say(dayInfo.greeting);

    // 2. Mood monitoring
    state.phase = "mood";
    const m = dayInfo.metaphor;
    await say("How are you feeling today?\n\n" + m.options.map((o) => o.t + " – " + o.d).join("\n"));
    const moodReply = await waitForUser(m.options.map((o) => ({ label: o.t, value: o.t })));
    await maybeRisk(moodReply.text);
    const mood = classifyMood(moodReply.text, m);
    log("clover", "[MOOD=" + mood + "]");

    if (mood === "pos" || mood === "kpos") {
      if (Math.random() < 0.5) {
        await say(pick(C.moodFollowPos));
        const r = await waitForUser();
        const risky = await maybeRisk(r.text);
        if (!risky) await reflect("What made your day good?", r.text);
      } else {
        await say(pick(C.ackPos));
      }
    } else if (mood === "neg" || mood === "kneg") {
      if (Math.random() < 0.5) {
        await say(pick(C.moodFollowNeg));
        const r = await waitForUser();
        const risky = await maybeRisk(r.text);
        if (!risky) await reflect("What would make your day better?", r.text);
      } else {
        await say(pick(C.ackNeg));
      }
    } else {
      await say(pick(C.ackNeu));
    }

    // 3. BA check-in (yesterday's challenge)
    if (prevDay && prevDay.ba && prevDay.ba.checkin) {
      state.phase = "ba-checkin";
      await say(prevDay.ba.checkin);
      const r = await waitForUser();
      const risky = await maybeRisk(r.text);
      if (!risky) await say(saysNotDone(r.text) ? prevDay.ba.notDone : prevDay.ba.done);
    }

    // 4. Fun fact
    state.phase = "funfact";
    const ff = dayInfo.funFact;
    if (ff.type === "s") {
      await say(ff.text);
      await say(pick(C.funFactTapbacks), { typingMs: 800 });
      // Tapback logic: react -> continue immediately; silence -> 10s then continue.
      await waitForUser(REACTION_CHIPS, { timeoutMs: 10000 });
      await wait(300);
    } else {
      await say(ff.q);
      const guess = await waitForUser();
      await maybeRisk(guess.text);
      await say(ff.a, { afterMs: 600 });
    }

    // 5. Intervention content
    state.phase = "intervention";
    const ex = dayInfo.exercise;
    if (dayInfo.cat === "mf" || dayInfo.cat === "mb") {
      await runAudioIntervention(dayInfo);
    } else {
      log("clover", "[INTERVENTION " + dayInfo.cat + " W" + dayInfo.week + "," + dayInfo.n + (ex.cancer ? " CANCER" : "") + "]");
      const allowSwap = !!ex.swap && !ex.final;
      const result = await runSteps(ex.def, allowSwap);
      if (result === "swapped") {
        await say("No problem at all! Let's try this one instead 😊", { typingMs: 800 });
        log("clover", "[SWAPPED]");
        await runSteps(ex.swap, false);
      }
    }

    // 6. Affirmation
    state.phase = "affirmation";
    await say(dayInfo.affirmation, { typingMs: 900 });

    // 7. Badge + streak
    state.phase = "badge";
    await wait(300);
    if (dayInfo.day === 28) {
      await say(C.day28BadgeIntro);
      addBadge(C.day28Badge);
    } else {
      addBadge("Day " + dayInfo.day + " Badge Awarded 🏆: " + dayInfo.badge);
    }
    await wait(800);
    await say("Streak: " + dayInfo.day + " day" + (dayInfo.day > 1 ? "s" : "") + " 🔥", { typingMs: 600 });

    // 8. Behavioral activation challenge
    state.phase = "ba";
    await say(dayInfo.ba.ch);
  }

  /* ================= Onboarding ================= */
  async function runOnboarding() {
    state.phase = "onboarding";
    state.dayNum = 0;
    addSeparator("Getting to know you");

    await say(C.onboardingIntro, { typingMs: 2200 });

    // Interests (multi-select buttons, paired with tailored BA)
    await say("What are your interests? Tap all that apply, then hit Done!");
    const picked = [];
    await new Promise((resolve) => {
      const done = (val) => { state.pendingInput = null; chipsBar.innerHTML = ""; resolve(val); };
      state.pendingInput = done;
      const chips = C.interests.map((name) => ({
        label: name,
        onTap: (btn) => {
          btn.classList.toggle("selected");
          const i = picked.indexOf(name);
          if (i >= 0) picked.splice(i, 1); else picked.push(name);
        }
      })).concat([{ label: "Done ✅", onTap: () => {
        addMessage(picked.length ? picked.join(", ") : "(none)", "sent");
        done();
      } }]);
      renderChips(chips, done);
      updateInputState(false);
    });
    settings.interests = picked;
    await say("Nice picks! I'll keep those in mind for your daily challenges ✨");

    // Cancer question
    await say("Would you like Clover to ask you positive psychology exercises about your cancer experience?");
    let r = await waitForUser([{ label: "Yes", value: "yes" }, { label: "No", value: "no" }]);
    settings.cancerOK = /^y/i.test(r.text.trim());
    await say(settings.cancerOK
      ? "Got it — I'll include some reflections about your cancer experience. You can always swap any question. 💛"
      : "Totally okay! I'll keep our reflections general. 💛");

    // Values (select 3)
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
    await say("Love those. I'll remember them ✨");

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
    await say("Noted! 📝");

    // Deep question days
    await say("Which two days of the week would you like Clover to ask you to reflect on emotionally deeper positive psychology questions? (Either choose two days of the week or say \"surprise me\" if you don't have a preference)");
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
      })).concat([{ label: "Surprise me 🎁", onTap: () => { addMessage("Surprise me 🎁", "sent"); done(); } }]), done);
      updateInputState(false);
    });
    settings.deepDays = dd;
    await say("Got it! 🌱");

    // Voice choice
    await say("Some of the exercises you will do are mindfulness audio exercises. Clover's helper, Cathy or Cody, will guide you through them. Choose the voice you'd like to hear for mindfulness exercises.");
    let previewAudio = null;
    let previewNote = false;
    const playPreview = async (name) => {
      if (previewAudio) previewAudio.pause();
      previewAudio = new Audio(BASE + "assets/audio2/preview-" + name.toLowerCase() + ".mp3");
      previewAudio.addEventListener("error", async () => {
        if (!previewNote) { previewNote = true; await say("(" + name + "'s voice sample is coming soon!)", { typingMs: 500 }); }
      });
      previewAudio.play().catch(() => {});
      previewAudio.addEventListener("timeupdate", function stopAt() {
        if (this.currentTime >= 8) { this.pause(); this.removeEventListener("timeupdate", stopAt); }
      });
    };
    r = await waitForUser([
      { label: "▶️ Hear Cathy", onTap: () => playPreview("Cathy") },
      { label: "▶️ Hear Cody", onTap: () => playPreview("Cody") },
      { label: "Cathy 🎙️", value: "Cathy" },
      { label: "Cody 🎙️", value: "Cody" }
    ]);
    if (previewAudio) previewAudio.pause();
    settings.voice = /cody/i.test(r.text) ? "Cody" : "Cathy";
    await say("Great — " + settings.voice + " it is! 🎧");

    settings.onboarded = true;
    saveSettings();
    await say("That's everything — you're all set! 🎉");
  }

  /* ================= Main ================= */
  const progressKey = "clover2-progress-w" + WEEK + "-" + settings.pid;

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

  /* ---------- Team-testing mode ----------
     Session lives in sessionStorage (per-tab): the tester's name/ID and
     their onboarding answers survive week switches, but a new tab or
     "New tester" starts clean. Picking a week (side buttons) reloads and
     replays that week from its first day using the SAME onboarding. */
  const TS_KEY = "clover2-test-session";
  function loadSession() {
    try { return JSON.parse(sessionStorage.getItem(TS_KEY)); } catch (e) { return null; }
  }
  function saveSession(sess) { sessionStorage.setItem(TS_KEY, JSON.stringify(sess)); }

  function buildTestControls(session) {
    const old = document.getElementById("restartBtn");
    if (old) old.remove();
    const panel = document.createElement("div");
    panel.className = "test-controls";
    panel.innerHTML = '<div class="test-controls-title">🍀 Testing' +
      (session && session.settings.pid ? "<span>" + escapeHtml(session.settings.pid) + "</span>" : "") + "</div>";

    for (let w = 1; w <= 4; w++) {
      const b = document.createElement("button");
      b.textContent = "Week " + w + (session && session.week === w ? " ▶" : "");
      if (session && session.week === w) b.classList.add("active");
      b.addEventListener("click", () => {
        const sess = loadSession();
        if (!sess || !sess.settings.onboarded) {
          alert("Please finish the onboarding screener first 😊");
          return;
        }
        if (sess.week === w && !confirm("Restart Week " + w + " from Day " + ((w - 1) * 7 + 1) + " with the same onboarding answers?")) return;
        sess.week = w;
        saveSession(sess);
        location.reload();
      });
      panel.appendChild(b);
    }

    const nb = document.createElement("button");
    nb.className = "new-tester";
    nb.textContent = "🔄 New tester";
    nb.addEventListener("click", () => {
      if (!confirm("Start over with a new tester? This session's onboarding answers will be cleared (logs are already saved).")) return;
      sessionStorage.removeItem(TS_KEY);
      location.reload();
    });
    panel.appendChild(nb);
    document.body.appendChild(panel);
  }

  /* Name prompt shown as an overlay on page load — not part of the chat. */
  function askTesterName() {
    return new Promise((resolve) => {
      const ov = document.createElement("div");
      ov.className = "setup-overlay open";
      ov.innerHTML = '<div class="setup-panel" style="text-align:center">' +
        '<h2>🍀 Clover team testing</h2>' +
        '<p class="sub">Enter your name to start a fresh test session. You will get a session ID like "Hailey #335" so your chat logs are easy to find. The name does not have to be unique.</p>' +
        '<input type="text" id="testerName" placeholder="Your name" style="text-align:center;font-size:15px" maxlength="40">' +
        '<div class="setup-actions" style="justify-content:center">' +
        '<button class="primary" id="testerGo">Start testing →</button></div></div>';
      document.body.appendChild(ov);
      const input = ov.querySelector("#testerName");
      const go = () => {
        const name = input.value.trim();
        if (!name) { input.focus(); return; }
        ov.remove();
        resolve(name);
      };
      ov.querySelector("#testerGo").addEventListener("click", go);
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
      setTimeout(() => input.focus(), 100);
    });
  }

  async function mainTesting() {
    document.getElementById("weekBadge").textContent = "Team testing";
    let session = loadSession();
    buildTestControls(session);

    if (!session) {
      const name = await askTesterName();
      settings.pid = name + " #" + Math.floor(100 + Math.random() * 900);
      settings.onboarded = false;
      session = { settings, week: null };
      saveSession(session);
      buildTestControls(session);
      document.querySelector(".test-controls .test-controls-title").innerHTML = "🍀 Testing<span>" + escapeHtml(settings.pid) + "</span>";
      log("clover", "[SESSION START tester=" + settings.pid + "]");
      await wait(400);
      await runOnboarding();
      session.settings = settings;
      saveSession(session);
      await say("You're all set! 🎉 Use the Week 1–4 buttons on the side to pick a week to test.");
      return;
    }

    Object.assign(settings, session.settings);

    if (!settings.onboarded) {
      log("clover", "[SESSION RESUME tester=" + settings.pid + " re-onboarding]");
      await wait(400);
      await runOnboarding();
      session.settings = settings;
      saveSession(session);
      await say("You're all set! 🎉 Use the Week 1–4 buttons on the side to pick a week to test.");
      return;
    }

    if (!session.week) {
      await wait(400);
      await say("Welcome back! Pick a week to test using the buttons on the side 🍀");
      return;
    }

    const w = session.week;
    const schedule = buildSchedule();
    const start = (w - 1) * 7;
    addSeparator("Testing Week " + w + " — " + settings.pid);
    log("clover", "[WEEK " + w + " START tester=" + settings.pid + "]");

    for (let i = 0; i < 7; i++) {
      const g = start + i;
      await dayButton((i === 0 ? "Start" : "Continue to") + " Day " + (g + 1) + " →");
      await runDay(schedule[g], g > 0 ? schedule[g - 1] : null);
    }
    addSeparator("Week " + w + " complete 🎉");
    await say("That's all of Week " + w + "! Pick another week on the side, or hit 🔄 New tester to start over. 💛");
  }

  async function main() {
    updateStatusTime();
    setInterval(updateStatusTime, 30000);
    autosizeInput();
    updateInputState(false);

    if (TESTING) { await mainTesting(); return; }

    document.getElementById("weekBadge").textContent = "Week " + WEEK;

    await wait(500);

    if (!settings.onboarded) {
      await runOnboarding();
    } else if (WEEK > 1) {
      await say("Welcome back for Week " + WEEK + "! 🍀");
    }

    const schedule = buildSchedule();
    const startIdx = (WEEK - 1) * 7;
    const doneCount = Number(localStorage.getItem(progressKey) || 0);
    let i = Math.min(doneCount, 6);
    if (doneCount > 0 && doneCount < 7) {
      addSeparator("Resuming — Days " + (startIdx + 1) + "–" + (startIdx + doneCount) + " already completed");
    }
    if (doneCount >= 7) {
      addSeparator("Week " + WEEK + " already completed 🎉");
      await say("You've finished all of Week " + WEEK + "! See you next week 💛");
      return;
    }

    for (; i < 7; i++) {
      const globalIdx = startIdx + i;
      await dayButton((i === doneCount && doneCount === 0 && WEEK === 1 ? "Start" : "Continue to") + " Day " + (globalIdx + 1) + " →");
      const prevDay = globalIdx > 0 ? schedule[globalIdx - 1] : null;
      await runDay(schedule[globalIdx], prevDay);
      localStorage.setItem(progressKey, String(i + 1));
    }

    addSeparator("Week " + WEEK + " complete 🎉");
    await say(WEEK === 4
      ? "That's the end of the 28-day journey. Thank you so much for spending this time with me. 💛🍀"
      : "That's a wrap on Week " + WEEK + "! See you in Week " + (WEEK + 1) + " 💛🍀");
  }

  /* ================= Setup panel ================= */
  const overlay = document.getElementById("setupOverlay");
  const statusEl = document.getElementById("setupStatus");

  function setGearStatus(msg) {
    document.getElementById("setupGear").title = msg || "Researcher setup";
  }

  function openSetup() {
    document.getElementById("cfgLogUrl").value = config.logUrl || "";
    document.getElementById("cfgPid").value = settings.pid;
    document.getElementById("cfgOffline").checked = config.offline;
    statusEl.textContent = "";
    statusEl.className = "setup-status";
    overlay.classList.add("open");
  }

  function readSetupForm() {
    config.logUrl = document.getElementById("cfgLogUrl").value.trim();
    config.offline = document.getElementById("cfgOffline").checked;
    const pid = document.getElementById("cfgPid").value.trim();
    if (pid && pid !== settings.pid) { settings.pid = pid; saveSettings(); }
    saveConfig();
  }

  document.getElementById("setupGear").addEventListener("click", openSetup);
  document.getElementById("cfgClose").addEventListener("click", () => overlay.classList.remove("open"));
  document.getElementById("cfgSave").addEventListener("click", () => {
    readSetupForm();
    statusEl.textContent = "Saved.";
    statusEl.className = "setup-status ok";
  });
  document.getElementById("cfgTest").addEventListener("click", async () => {
    readSetupForm();
    statusEl.textContent = "Testing AI connection…";
    statusEl.className = "setup-status";
    const saved = config.offline;
    config.offline = false;
    const r = await geminiReflect("How are you feeling today?", "Pretty good, I spent time with my dog.");
    config.offline = saved;
    if (C.fallbackReflections.includes(r)) {
      statusEl.textContent = "❌ " + (lastGeminiError || "Could not reach the backend.") + " — check the Apps Script URL and setup (see apps-script/Code.gs).";
      statusEl.className = "setup-status err";
    } else {
      statusEl.textContent = "✅ AI responded: \"" + r + "\"";
      statusEl.className = "setup-status ok";
    }
  });
  document.getElementById("cfgDownload").addEventListener("click", downloadTranscript);
  document.getElementById("cfgResetWeek").addEventListener("click", () => {
    if (!confirm("Restart this week's conversation? Local transcript + progress for this week will be cleared.")) return;
    localStorage.removeItem(transcriptKey);
    localStorage.removeItem(progressKey);
    location.reload();
  });
  document.getElementById("cfgResetAll").addEventListener("click", () => {
    if (!confirm("New participant? Clears onboarding answers, progress, and local transcripts on this device.")) return;
    Object.keys(localStorage).filter((k) => k.startsWith("clover2-")).forEach((k) => {
      if (k !== CONFIG_KEY) localStorage.removeItem(k);
    });
    location.reload();
  });

  if (urlParams.get("setup")) setTimeout(openSetup, 400);

  window.__cloverSchedule2 = buildSchedule;
  main();
})();
