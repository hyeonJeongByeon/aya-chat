/* AYA-CHAT Clover engine
   Expects window.CLOVER_WEEK (1-4) set by the page, and content.js loaded first.
   - Builds a seeded, mutually-exclusive 28-day schedule (same seed => same
     partition across all four week links).
   - Week 1 runs the onboarding screener before Day 1.
   - Gemini (Vertex AI) generates only the active-listening reflections;
     everything else is scripted word-for-word.
*/
(function () {
  const C = window.CLOVER_CONTENT;
  const WEEK = window.CLOVER_WEEK || 1;
  // Demo/sample mode: onboarding runs on EVERY page load and the seed is
  // re-randomized per session (unless ?seed= is given).
  const DEMO = !!window.CLOVER_DEMO;

  /* Voice audio (assets/audio). Two voices x two exercises. */
  const AUDIO = {
    preview: { ai: "assets/audio/ucla-ai.mp3", human: "assets/audio/ucla-human.mp3" },
    mf: { ai: "assets/audio/ucla-ai.mp3", human: "assets/audio/ucla-human.mp3" },
    mb: { ai: "assets/audio/mbsc-ai.mp3", human: "assets/audio/mbsc-human.mp3" }
  };

  /* ================= Seeded RNG ================= */
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
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

  /* ================= Persistent settings ================= */
  const SETTINGS_KEY = DEMO ? "clover-demo-settings" : "clover-settings";
  const CONFIG_KEY = "clover-config";

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }

  const urlParams = new URLSearchParams(location.search);

  // Demo mode always starts a fresh participant session.
  let settings = DEMO ? null : loadJSON(SETTINGS_KEY, null);
  if (!settings) {
    settings = {
      seed: urlParams.get("seed") || String(Math.floor(Math.random() * 1e9)),
      cancerOK: false,
      values: [],
      hobbies: "",
      deepDays: "",
      voice: "",
      onboarded: false
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
  if (urlParams.get("seed") && urlParams.get("seed") !== settings.seed) {
    settings.seed = urlParams.get("seed");
    saveSettings();
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  let config = loadJSON(CONFIG_KEY, {
    token: "", project: "", location: "us-central1",
    model: "gemini-2.5-flash", offline: false, logUrl: ""
  });

  function saveConfig() { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); }

  // Backend URL resolution for participants who arrive with a clean
  // browser: ?log=... beats the panel-saved value, which beats the
  // site-wide default baked into assets/site-config.js.
  if (urlParams.get("log")) config.logUrl = urlParams.get("log");
  else if (!config.logUrl && window.CLOVER_DEFAULT_LOG_URL) config.logUrl = window.CLOVER_DEFAULT_LOG_URL;

  /* ================= Schedule builder =================
     Partitions the whole bank across 28 days so any two weeks are
     mutually exclusive for the same seed.
  */
  function buildSchedule() {
    const rng = mulberry32(hashStr("clover-" + settings.seed));

    // --- intervention pairs, category by category ---
    // Savoring: pair each Present with a Future (both shuffled), 5 pairs.
    const savP = shuffled(C.savoringPresent, rng);
    const savF = shuffled(C.savoringFuture, rng);
    const savPairs = savP.map((p, i) => [p, savF[i]]);

    const grPairs = shuffled(C.gratitudePairs, rng);
    const mfPairs = shuffled(C.mindfulnessPairs, rng);
    const mbPairs = shuffled(C.mbscPairs, rng);

    // Meaning: 2 light pairs + 5 deep pairs = 7.
    // If the participant picked values, one deep pair becomes the
    // personalized values pair.
    // NOTE: every rng() call below must run unconditionally, so the same
    // seed yields the same partition on all four week pages regardless of
    // onboarding answers (mutual exclusivity across weeks depends on it).
    let deepPairs = shuffled(C.meaningDeepPairs, rng);
    const valuesSlot = Math.floor(rng() * deepPairs.length);
    if (settings.values && settings.values.length) {
      deepPairs = deepPairs.slice();
      deepPairs[valuesSlot] = C.meaningValuesPair;
    }
    const lightPairs = shuffled(C.meaningLightPairs, rng);

    // Meaning day ordering: light first (weeks 2-3 start gentler), deep after.
    // Slots: w2 has 2 meaning days, w3 has 2, w4 has 3.
    // Arrangement: [L, D] in w2, [L, D] in w3, [D, D, D] in w4.
    const meaningSeq = [lightPairs[0], deepPairs[0], lightPairs[1], deepPairs[1],
                        deepPairs[2], deepPairs[3], deepPairs[4]];

    // Cancer participants: meaning DEFAULT is always a cancer prompt,
    // swap is the non-cancer prompt (first of each scheduled pair).
    const cancerSeq = shuffled(C.cancerPrompts, rng).slice(0, 7);

    // --- category layout per week (timeline sample) ---
    const weekCats = [
      shuffled(["sav", "sav", "gr", "gr", "mf", "mf", "mb"], rng),
      shuffled(["sav", "gr", "mn", "mn", "mf", "mf", "mb"], rng),
      shuffled(["sav", "gr", "mn", "mn", "mf", "mf", "mb"], rng),
      shuffled(["sav", "gr", "mn", "mn", "mn", "mf", "mb"], rng)
    ];

    // --- per-day extras, all partitioned across 28 days ---
    const statements = shuffled(C.funFactsStatement, rng).slice(0, 14);
    const trivia = shuffled(C.funFactsTrivia, rng).slice(0, 14);
    const tapbacks = shuffled(C.funFactTapbacks, rng);
    const badges = shuffled(C.badges, rng);
    const affirmations = shuffled(C.affirmations, rng);
    const bas = shuffled(C.baChallenges, rng);
    const greet1 = shuffled(C.greetings, rng);
    const greet2 = shuffled(C.greetings, rng);
    const greetings = greet1.concat(greet2);
    const metaphorOrders = [0, 1, 2, 3].map(() => shuffled(C.moodMetaphors, rng));

    const idx = { sav: 0, gr: 0, mn: 0, mf: 0, mb: 0, st: 0, tr: 0 };
    const days = [];

    for (let d = 0; d < 28; d++) {
      const week = Math.floor(d / 7);
      const cat = weekCats[week][d % 7];
      let pair, isCancerDay = false, audio = null;

      if (cat === "sav") pair = savPairs[idx.sav++];
      else if (cat === "gr") { pair = grPairs[idx.gr++]; }
      else if (cat === "mf") { if (idx.mf === 0) audio = "mf"; pair = mfPairs[idx.mf++]; }
      else if (cat === "mb") { if (idx.mb === 0) audio = "mb"; pair = mbPairs[idx.mb++]; }
      else {
        const mi = idx.mn++;
        if (settings.cancerOK) {
          // default = cancer prompt, swap = non-cancer (default of scheduled pair)
          pair = [cancerSeq[mi], meaningSeq[mi][0]];
          isCancerDay = true;
        } else {
          pair = meaningSeq[mi];
        }
      }

      // Randomize which prompt is default vs swap (not for cancer days:
      // cancer prompt is ALWAYS the default per the content spec).
      // rng() is consumed unconditionally to keep the stream aligned.
      const flip = rng() < 0.5;
      let def = pair[0], swap = pair[1];
      if (!isCancerDay && flip) { def = pair[1]; swap = pair[0]; }

      // Fun facts alternate: statements on even days, trivia on odd days.
      const funFact = (d % 2 === 0)
        ? { type: "statement", text: statements[idx.st], tapback: tapbacks[idx.st % tapbacks.length] }
        : { type: "trivia", q: trivia[idx.tr].q, a: trivia[idx.tr].a };
      if (d % 2 === 0) idx.st++; else idx.tr++;

      days.push({
        day: d + 1,
        week: week + 1,
        cat, isCancerDay, audio,
        def, swap,
        funFact,
        badge: badges[d],
        affirmation: affirmations[d],
        ba: bas[d],
        greeting: greetings[d],
        metaphor: metaphorOrders[week][d % 7]
      });
    }
    return days;
  }

  /* ================= Transcript logging ================= */
  const transcriptKey = "clover-transcript-w" + WEEK + "-" + settings.seed;
  let transcript = loadJSON(transcriptKey, []);

  function log(who, text, phase) {
    const entry = { t: new Date().toISOString(), seed: settings.seed, week: WEEK, day: state.dayNum, phase: phase || state.phase, who, text };
    transcript.push(entry);
    localStorage.setItem(transcriptKey, JSON.stringify(transcript));
    remoteLog(entry);
  }

  /* Remote live log (Google Apps Script -> Google Sheet).
     Fire-and-forget queue that preserves message order. */
  const remoteQueue = [];
  let remotePumping = false;

  function remoteLog(entry) {
    if (!config.logUrl) return;
    remoteQueue.push(entry);
    pumpRemoteQueue();
  }

  async function pumpRemoteQueue() {
    if (remotePumping) return;
    remotePumping = true;
    while (remoteQueue.length) {
      const entry = remoteQueue.shift();
      try {
        // text/plain body avoids a CORS preflight, which Apps Script
        // web apps do not answer.
        await fetch(config.logUrl, { method: "POST", body: JSON.stringify(entry) });
      } catch (e) {
        console.warn("remote log failed:", e);
        setGearStatus("⚠️ Live log unreachable (messages still saved locally)");
      }
    }
    remotePumping = false;
  }

  function downloadTranscript() {
    const blob = new Blob([JSON.stringify({ seed: settings.seed, settings, transcript }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "clover-week" + WEEK + "-transcript-" + new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-") + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ================= Gemini (Vertex AI) ================= */
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

  async function geminiReflect(question, answer) {
    if (config.offline) return fallbackReflection();

    // Preferred path: the Apps Script backend proxies Vertex AI with the
    // researcher's own auto-refreshed credentials, so a shared link works
    // whenever a participant opens it — no 1-hour token involved.
    if (config.logUrl) {
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
        // fall through to the direct-token path if one is configured
      }
    }

    if (!config.token || !config.project) {
      if (!config.logUrl) lastGeminiError = "No Apps Script URL and no token configured";
      setGearStatus("⚠️ Gemini unavailable — using fallback replies");
      return fallbackReflection();
    }

    const url = "https://" + config.location + "-aiplatform.googleapis.com/v1/projects/" +
      encodeURIComponent(config.project) + "/locations/" + config.location +
      "/publishers/google/models/" + config.model + ":generateContent";

    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: "user",
        parts: [{ text: "Clover asked: \"" + question + "\"\n\nParticipant answered: \"" + answer + "\"\n\nWrite Clover's brief active-listening reflection." }]
      }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingBudget: 0 }
      }
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Authorization": "Bearer " + config.token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.json()).error?.message || ""; } catch (e) {}
        throw new Error("HTTP " + res.status + (detail ? " — " + detail.slice(0, 200) : ""));
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
      if (!text) throw new Error("empty response");
      setGearStatus("");
      return text;
    } catch (e) {
      console.warn("Gemini call failed, using fallback:", e);
      lastGeminiError = e.message || String(e);
      setGearStatus("⚠️ Gemini unavailable — using fallback replies");
      return fallbackReflection();
    }
  }

  let lastGeminiError = "";

  let fbIdx = Math.floor(Math.random() * C.fallbackReflections.length);
  function fallbackReflection() {
    fbIdx = (fbIdx + 1) % C.fallbackReflections.length;
    return C.fallbackReflections[fbIdx];
  }

  async function testGemini() {
    const saved = config.offline;
    config.offline = false;
    const r = await geminiReflect("How are you feeling today?", "Pretty good, I spent time with my dog.");
    config.offline = saved;
    return r;
  }

  /* ================= Chat UI ================= */
  const messagesArea = document.getElementById("messagesArea");
  const inputField = document.getElementById("inputField");
  const sendBtn = document.getElementById("sendBtn");
  const chatForm = document.getElementById("chatForm");
  const statusTime = document.getElementById("statusTime");
  const dateSep = document.getElementById("dateSep");
  const chipsBar = document.getElementById("chipsBar");

  const state = { busy: false, dayNum: 0, phase: "boot", lastCloverRow: null, pendingInput: null };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function scrollToBottom() {
    // Two passes: immediately after layout, and again once animations settle.
    requestAnimationFrame(() => { messagesArea.scrollTop = messagesArea.scrollHeight; });
    setTimeout(() => { messagesArea.scrollTop = messagesArea.scrollHeight; }, 320);
  }

  function updateStatusTime() {
    const now = new Date();
    const fmt = (opts) => new Intl.DateTimeFormat("en-US", opts).format(now);
    statusTime.textContent = fmt({ hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s?[AP]M$/, "");
    dateSep.textContent = "Today " + fmt({ hour: "numeric", minute: "2-digit", hour12: true });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    const cls = "bubble " + (side === "sent" ? "sent" : "received") + (extraClass ? " " + extraClass : "");
    row.innerHTML = '<div class="' + cls + '">' + escapeHtml(text) + "</div>";
    messagesArea.appendChild(row);
    if (side !== "sent") state.lastCloverRow = row;
    scrollToBottom();
    log(side === "sent" ? "participant" : "clover", text);
    return row;
  }

  function addAudioMessage(src, caption) {
    const row = document.createElement("div");
    row.className = "message-row received";
    row.innerHTML = '<div class="bubble received audio-bubble">'
      + (caption ? '<span class="audio-caption">' + escapeHtml(caption) + "</span>" : "")
      + '<audio controls preload="metadata" src="' + src + '"></audio></div>';
    messagesArea.appendChild(row);
    state.lastCloverRow = row;
    scrollToBottom();
    log("clover", "[AUDIO] " + src);
    return row;
  }

  function addBadge(text) {
    const row = document.createElement("div");
    row.className = "message-row received";
    row.innerHTML = '<div class="bubble received badge-card"><span class="badge-label">🏅 Badge unlocked</span>' + escapeHtml(text) + "</div>";
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
    const bubble = state.lastCloverRow.querySelector(".bubble");
    const tb = document.createElement("div");
    tb.className = "tapback";
    tb.textContent = emoji;
    bubble.appendChild(tb);
    log("participant", "[TAPBACK] " + emoji);
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

  /* Clover speaks: typing delay scales with message length */
  async function say(text, opts = {}) {
    const typing = addTypingIndicator();
    const ms = opts.typingMs ?? Math.min(900 + text.length * 14, 3200);
    await wait(ms);
    typing.remove();
    addMessage(text, "received", opts.extraClass);
    await wait(opts.afterMs ?? 500);
  }

  /* Quiet pause standing in for [10 second pause] */
  async function pauseBeat(sec) {
    await wait(Math.min(sec, 10) * 1000);
  }

  /* Wait for participant input (typed text) and/or chip tap.
     chips: [{label, value, reaction?, keep?}] — resolves with the chip value. */
  function waitForUser(chips) {
    return new Promise((resolve) => {
      state.pendingInput = resolve;
      renderChips(chips || []);
      updateInputState(true);
      inputField.focus();
    });
  }

  function renderChips(chips) {
    chipsBar.innerHTML = "";
    chips.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (c.reaction ? " reaction" : "");
      btn.textContent = c.label;
      btn.addEventListener("click", () => {
        if (!state.pendingInput) return;
        if (c.onTap) { c.onTap(btn); return; }
        const resolve = state.pendingInput;
        state.pendingInput = null;
        chipsBar.innerHTML = "";
        updateInputState(false);
        if (c.reaction) addTapbackToLast(c.label);
        else if (!c.silent) addMessage(c.label, "sent");
        resolve({ text: c.value ?? c.label, chip: true, reaction: !!c.reaction });
      });
      chipsBar.appendChild(btn);
    });
    scrollToBottom();
  }

  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = inputField.value.trim();
    if (!text || !state.pendingInput) return;
    const resolve = state.pendingInput;
    state.pendingInput = null;
    chipsBar.innerHTML = "";
    addMessage(text, "sent");
    inputField.value = "";
    autosizeInput();
    updateInputState(false);
    resolve({ text, chip: false });
  });

  inputField.addEventListener("input", autosizeInput);
  inputField.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });

  /* ================= Flow helpers ================= */
  const SWAP_CUES = ["swap", "different question", "something else", "another question",
    "skip", "switch", "don't want", "do not want", "dont want", "not in the mood",
    "rather not", "not talk about", "uncomfortable", "pass"];

  function wantsSwap(text) {
    const n = text.toLowerCase();
    return SWAP_CUES.some((c) => n.includes(c));
  }

  function classifyMood(text, metaphor) {
    const n = text.toLowerCase();
    const hit = (words) => words.some((w) => n.includes(w));
    if (hit(metaphor.neg) || hit(C.moodWordsNegative)) return "negative";
    if (hit(metaphor.pos) || hit(C.moodWordsPositive)) return "positive";
    if (hit(metaphor.neu) || hit(C.moodWordsNeutral)) return "neutral";
    return "neutral";
  }

  function fillValues(text) {
    const v = C.values.find((x) => settings.values.includes(x.name)) ||
      C.values[Math.floor(Math.random() * C.values.length)];
    return text.replaceAll("{V}", v.name).replaceAll("{DEF}", v.def);
  }

  /* Run one intervention prompt's steps. swapAllowed: offer swap before the
     first answer. Returns "swapped" if the participant asked to swap. */
  async function runPrompt(prompt, swapAllowed) {
    let firstAskDone = false;
    for (const step of prompt.steps) {
      if (typeof step === "string") {
        await say(fillValues(step));
        continue;
      }
      if (step.pause) { await pauseBeat(step.pause); continue; }

      const q = fillValues(step.ask || step.askNR);
      await say(q);

      if (swapAllowed && !firstAskDone) {
        await say(pick(C.swapOffers), { typingMs: 900 });
      }

      const chips = (swapAllowed && !firstAskDone) ? [{ label: "🔄 Swap question", value: "__swap__" }] : [];
      const reply = await waitForUser(chips);

      if (swapAllowed && !firstAskDone && (reply.text === "__swap__" || wantsSwap(reply.text))) {
        return "swapped";
      }
      firstAskDone = true;

      if (step.ask) {
        const typing = addTypingIndicator();
        const reflection = await geminiReflect(q, reply.text);
        typing.remove();
        addMessage(reflection, "received");
        log("clover", "[GEMINI] " + reflection);
        await wait(600);
      }
    }
    return "done";
  }

  /* Audio-guided exercise (first mindfulness day + first MBSC day).
     Plays the participant's preferred voice; swapping falls back to the
     scheduled text exercise for the same category. */
  async function runAudioIntervention(dayInfo) {
    const voice = settings.voice === "human" ? "human" : "ai";
    const src = AUDIO[dayInfo.audio][voice];
    const kind = dayInfo.audio === "mb" ? "self-compassion" : "mindfulness";
    log("clover", "[INTERVENTION cat=" + dayInfo.cat + " AUDIO=" + src + "]");

    await say("For today's exercise, one of Clover's friends is going to guide you through a short " + kind + " practice 🎧");
    addAudioMessage(src, "Guided " + kind + " exercise");
    await wait(600);
    await say("Find a comfy spot, press ▶️, and follow along. Take all the time you need — I'll be right here.");
    await say("If audio isn't your vibe today, we can do a text version instead — just say so or tap below.", { typingMs: 900 });

    const reply = await waitForUser([
      { label: "✅ I finished the exercise", value: "__done__" },
      { label: "🔄 Swap to a text exercise", value: "__swap__" }
    ]);

    if (reply.text === "__swap__" || wantsSwap(reply.text)) {
      await say("No problem at all! Let's try this one instead 😊", { typingMs: 900 });
      log("clover", "[SWAPPED to text " + dayInfo.def.id + "]");
      await runPrompt(dayInfo.def, false);
      return;
    }

    await say("React with a 👍 if you're glad you showed up for yourself");
    await waitForUser([
      { label: "👍", reaction: true }, { label: "❤️", reaction: true }, { label: "🧘", reaction: true }
    ]);
    await wait(400);

    // Close with the scripted sparkle line from the scheduled text prompt
    // of the same category.
    const closing = [...dayInfo.def.steps].reverse().find((s) => typeof s === "string" && s.startsWith("✨"));
    await say(closing || "✨ Nice work taking this moment for yourself.");
  }

  /* ================= Daily flow ================= */
  async function runDay(dayInfo, prevDay) {
    state.dayNum = dayInfo.day;
    state.phase = "greeting";
    addSeparator("Day " + dayInfo.day);

    // 1. Greeting
    await say(dayInfo.greeting);

    // 2. Mood monitoring
    state.phase = "mood";
    await say(dayInfo.metaphor.prompt);
    const moodReply = await waitForUser();
    const mood = classifyMood(moodReply.text, dayInfo.metaphor);
    log("clover", "[MOOD=" + mood + "]");

    if (mood === "positive") {
      await say(pick(C.moodAcks.positive));
      await say(pick(C.moodFollowUps.positive));
      const r = await waitForUser();
      const typing = addTypingIndicator();
      const refl = await geminiReflect("What made your day good?", r.text);
      typing.remove();
      addMessage(refl, "received");
      log("clover", "[GEMINI] " + refl);
    } else if (mood === "negative") {
      await say(pick(C.moodAcks.negative));
      await say(pick(C.moodFollowUps.negative));
      const r = await waitForUser();
      const typing = addTypingIndicator();
      const refl = await geminiReflect("What would make today a little better?", r.text);
      typing.remove();
      addMessage(refl, "received");
      log("clover", "[GEMINI] " + refl);
    } else {
      await say(pick(C.moodAcks.neutral));
    }
    await wait(500);

    // 3. BA check-in (about yesterday's challenge)
    if (prevDay) {
      state.phase = "ba-checkin";
      await say(prevDay.ba.checkin);
      const r = await waitForUser();
      const n = r.text.toLowerCase();
      const notDone = ["no", "not yet", "didn't", "didnt", "did not", "forgot", "couldn't", "couldnt", "nope", "haven't", "havent"]
        .some((w) => n === w || n.startsWith(w + " ") || n.includes(" " + w));
      if (notDone) {
        await say(prevDay.ba.notDone);
      } else {
        const typing = addTypingIndicator();
        const refl = await geminiReflect(prevDay.ba.checkin, r.text);
        typing.remove();
        addMessage(refl, "received");
        log("clover", "[GEMINI] " + refl);
        await wait(400);
        await say(prevDay.ba.done);
      }
    }

    // 4. Fun fact
    state.phase = "funfact";
    if (dayInfo.funFact.type === "statement") {
      await say(dayInfo.funFact.text);
      await say(dayInfo.funFact.tapback, { typingMs: 800 });
      // Reaction chips; typing a reply also works.
      state.lastCloverRow = messagesArea.querySelectorAll(".message-row.received:not(.typing-row)")[
        messagesArea.querySelectorAll(".message-row.received:not(.typing-row)").length - 2
      ] || state.lastCloverRow;
      await waitForUser([
        { label: "👍", reaction: true }, { label: "❤️", reaction: true },
        { label: "😂", reaction: true }, { label: "‼️", reaction: true },
        { label: "😮", reaction: true }
      ]);
      await wait(400);
    } else {
      await say(dayInfo.funFact.q);
      await waitForUser();
      await say(dayInfo.funFact.a, { afterMs: 700 });
    }

    // 5. Intervention content (default, swappable within same category)
    state.phase = "intervention";
    if (dayInfo.audio) {
      await runAudioIntervention(dayInfo);
    } else {
      log("clover", "[INTERVENTION cat=" + dayInfo.cat + " default=" + dayInfo.def.id + "]");
      const result = await runPrompt(dayInfo.def, true);
      if (result === "swapped") {
        await say("No problem at all! Let's try this one instead 😊", { typingMs: 900 });
        log("clover", "[SWAPPED to " + dayInfo.swap.id + "]");
        await runPrompt(dayInfo.swap, false);
      }
    }

    // 6. Affirmation
    state.phase = "affirmation";
    await say(dayInfo.affirmation, { typingMs: 1100 });

    // 7. Badge + streak
    await wait(400);
    addBadge(dayInfo.badge);
    await wait(900);
    const streak = dayInfo.day;
    await say("🔥 Streak: " + streak + " day" + (streak > 1 ? "s" : "") + " in a row!", { typingMs: 700 });

    // 8. Behavioral activation challenge
    state.phase = "ba";
    await say(dayInfo.ba.text);
  }

  /* ================= Onboarding (Week 1) ================= */
  async function runOnboarding() {
    state.phase = "onboarding";
    addSeparator("Getting to know you");

    await say("Hi! I'm Clover 🍀 I'm so glad you're here.");
    await say("Over the next 28 days, we'll spend a few minutes together each day — checking in, reflecting, and trying small activities to boost your well-being.");
    await say("Before we start Day 1, I'd love to get to know you a little. Ready?");
    await waitForUser([{ label: "Ready! 🙌", value: "ready" }, { label: "Let's do it", value: "ready" }]);

    // Hobbies / interests
    await say("In the last 2 months, have you been particularly interested in any books, TV shows, movies, videogames, or sports?");
    let r = await waitForUser();
    settings.hobbies = r.text;
    let typing = addTypingIndicator();
    let refl = await geminiReflect("Have you been particularly interested in any books, TV shows, movies, videogames, or sports?", r.text);
    typing.remove();
    addMessage(refl, "received");
    log("clover", "[GEMINI] " + refl);

    await say("When you're not working or in school, what do you enjoy doing in your free time?");
    r = await waitForUser();
    settings.hobbies += " | " + r.text;
    typing = addTypingIndicator();
    refl = await geminiReflect("What do you enjoy doing in your free time?", r.text);
    typing.remove();
    addMessage(refl, "received");
    log("clover", "[GEMINI] " + refl);

    // Cancer-specific
    await say("Now a couple of questions about your cancer journey — only share what feels comfortable. 💛");
    await say("At what age did you finish cancer treatment?");
    r = await waitForUser();
    await say("Thank you for sharing that with me. 💛", { typingMs: 900 });

    await say("Are you comfortable with Clover asking you cancer-related questions?");
    r = await waitForUser([{ label: "Yes", value: "yes" }, { label: "No", value: "no" }]);
    settings.cancerOK = /^y|yes|sure|ok/i.test(r.text.trim());
    await say(settings.cancerOK
      ? "Got it — thank you. I'll keep those questions gentle, and you can always skip or swap any question. 💛"
      : "Totally okay! I won't bring up cancer-related questions. You're in control here. 💛");

    // Values
    await say("Which of these values are most important to you right now? Pick 3:");
    const picked = [];
    await new Promise((resolve) => {
      state.pendingInput = () => {};
      const chips = C.values.map((v) => ({
        label: v.name, value: v.name,
        onTap: (btn) => {
          if (btn.classList.contains("selected")) {
            btn.classList.remove("selected");
            picked.splice(picked.indexOf(v.name), 1);
          } else if (picked.length < 3) {
            btn.classList.add("selected");
            picked.push(v.name);
          }
          if (picked.length === 3) {
            state.pendingInput = null;
            chipsBar.innerHTML = "";
            addMessage(picked.join(", "), "sent");
            resolve();
          }
        }
      }));
      renderChips(chips);
      updateInputState(false);
    });
    settings.values = picked;
    const defs = C.values.filter((v) => picked.includes(v.name));
    await say("Love those. " + defs.map((v) => v.name + " — " + v.def).join("; ") + ". I'll keep these in mind. ✨");

    // Deep question day personalization
    await say("What days would you prefer for Clover to ask some deeper questions? (Choose a day, or say \"surprise me\")");
    r = await waitForUser([
      { label: "Mon" }, { label: "Tue" }, { label: "Wed" }, { label: "Thu" },
      { label: "Fri" }, { label: "Sat" }, { label: "Sun" }, { label: "Surprise me 🎁" }
    ]);
    settings.deepDays = r.text;
    await say("Noted! 📝");

    // Voice preference — play a short snippet of each voice, then choose.
    await say("A couple of Clover's friends are going to help guide you through some mindfulness exercises later.");
    await say("Here's a little preview of each voice — tap ▶️ to listen, then pick the one you like best 🎧");

    let previewAudio = null;
    const playSnippet = (src) => {
      if (previewAudio) previewAudio.pause();
      previewAudio = new Audio(src);
      previewAudio.play();
      // 5-10 second snippet: stop the preview at 8 seconds.
      previewAudio.addEventListener("timeupdate", function stopAt() {
        if (this.currentTime >= 8) { this.pause(); this.removeEventListener("timeupdate", stopAt); }
      });
    };

    r = await waitForUser([
      { label: "▶️ Preview Voice 1", onTap: () => playSnippet(AUDIO.preview.ai) },
      { label: "▶️ Preview Voice 2", onTap: () => playSnippet(AUDIO.preview.human) },
      { label: "I like Voice 1 🎙️", value: "Voice 1" },
      { label: "I like Voice 2 🎙️", value: "Voice 2" },
      { label: "No preference", value: "No preference" }
    ]);
    if (previewAudio) previewAudio.pause();
    settings.voice = /2/.test(r.text) ? "human" : "ai";
    await say("Great choice! 🎧");

    settings.onboarded = true;
    saveSettings();

    await say("That's everything — you're all set! 🎉");
  }

  /* ================= Week runner ================= */
  const progressKey = "clover-progress-w" + WEEK + "-" + settings.seed;

  async function main() {
    updateStatusTime();
    setInterval(updateStatusTime, 30000);
    autosizeInput();
    updateInputState(false);

    document.getElementById("weekBadge").textContent = DEMO ? "Sample (7 days)" : "Week " + WEEK;

    await wait(600);

    // Onboarding runs BEFORE the schedule is built: cancer comfort and
    // chosen values decide which meaning-making prompts are scheduled.
    if (WEEK === 1 && !settings.onboarded) {
      await runOnboarding();
    } else if (WEEK > 1) {
      await say("Welcome back for Week " + WEEK + "! 🍀");
    }

    const schedule = buildSchedule();
    const startIdx = (WEEK - 1) * 7;
    const weekDays = schedule.slice(startIdx, startIdx + 7);

    for (let i = 0; i < weekDays.length; i++) {
      const globalIdx = startIdx + i;
      const prevDay = globalIdx > 0 ? schedule[globalIdx - 1] : null;

      if (i === 0) {
        await new Promise((resolve) => {
          const wrap = document.createElement("div");
          wrap.className = "day-btn-wrap";
          const btn = document.createElement("button");
          btn.className = "day-btn";
          btn.textContent = "Start Day " + weekDays[i].day + " →";
          btn.addEventListener("click", () => { wrap.remove(); resolve(); });
          wrap.appendChild(btn);
          messagesArea.appendChild(wrap);
          scrollToBottom();
        });
      }

      await runDay(weekDays[i], prevDay);

      if (i < weekDays.length - 1) {
        await new Promise((resolve) => {
          const wrap = document.createElement("div");
          wrap.className = "day-btn-wrap";
          const btn = document.createElement("button");
          btn.className = "day-btn";
          btn.textContent = "Continue to Day " + weekDays[i + 1].day + " →";
          btn.addEventListener("click", () => { wrap.remove(); resolve(); });
          wrap.appendChild(btn);
          messagesArea.appendChild(wrap);
          scrollToBottom();
        });
      }
    }

    addSeparator(DEMO ? "Sample complete 🎉" : "Week " + WEEK + " complete 🎉");
    await say(DEMO
      ? "That's the end of the sample! Thank you so much for spending this time with me. 💛🍀"
      : "That's a wrap on Week " + WEEK + "! Thank you so much for spending this time with me. 💛🍀");
  }

  /* ================= Setup panel ================= */
  const overlay = document.getElementById("setupOverlay");
  const statusEl = document.getElementById("setupStatus");

  function setGearStatus(msg) {
    const gear = document.getElementById("setupGear");
    gear.title = msg || "Researcher setup";
  }

  function openSetup() {
    document.getElementById("cfgToken").value = config.token;
    document.getElementById("cfgProject").value = config.project;
    document.getElementById("cfgLocation").value = config.location;
    document.getElementById("cfgModel").value = config.model;
    document.getElementById("cfgOffline").checked = config.offline;
    document.getElementById("cfgSeed").value = settings.seed;
    document.getElementById("cfgLogUrl").value = config.logUrl || "";
    statusEl.textContent = "";
    statusEl.className = "setup-status";
    overlay.classList.add("open");
  }

  function readSetupForm() {
    config.token = document.getElementById("cfgToken").value.trim();
    config.project = document.getElementById("cfgProject").value.trim();
    config.location = document.getElementById("cfgLocation").value.trim() || "us-central1";
    config.model = document.getElementById("cfgModel").value.trim() || "gemini-2.5-flash";
    config.offline = document.getElementById("cfgOffline").checked;
    config.logUrl = document.getElementById("cfgLogUrl").value.trim();
    const newSeed = document.getElementById("cfgSeed").value.trim();
    if (newSeed && newSeed !== settings.seed) {
      settings.seed = newSeed;
      saveSettings();
    }
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
    statusEl.textContent = "Testing Gemini connection…";
    statusEl.className = "setup-status";
    const r = await testGemini();
    if (C.fallbackReflections.includes(r)) {
      let hint = "";
      if (/PROJECT_ID not set/.test(lastGeminiError)) hint = " → Open the Apps Script editor and fill in PROJECT_ID in Code.gs, then redeploy (Manage deployments → edit → New version).";
      else if (/401/.test(lastGeminiError)) hint = " → Credentials rejected. Apps Script route: re-authorize the script (run testGemini in the editor). Token route: generate a fresh token.";
      else if (/403/.test(lastGeminiError)) hint = " → No access: wrong project ID, Vertex AI API not enabled, missing cloud-platform scope in appsscript.json, or the account lacks permission.";
      else if (/404/.test(lastGeminiError)) hint = " → Wrong project ID, location, or model name.";
      else if (/Failed to fetch|abort/i.test(lastGeminiError)) hint = " → Could not reach the endpoint: check the Apps Script URL ends in /exec and the deployment allows 'Anyone'.";
      statusEl.textContent = "❌ " + (lastGeminiError || "Could not reach Gemini.") + hint;
      statusEl.className = "setup-status err";
    } else {
      statusEl.textContent = "✅ Gemini responded: \"" + r + "\"";
      statusEl.className = "setup-status ok";
    }
  });
  document.getElementById("cfgDownload").addEventListener("click", downloadTranscript);
  document.getElementById("cfgResetWeek").addEventListener("click", () => {
    if (!confirm("Restart this week's conversation? The transcript for this week will be cleared.")) return;
    localStorage.removeItem(transcriptKey);
    localStorage.removeItem(progressKey);
    location.reload();
  });
  document.getElementById("cfgResetAll").addEventListener("click", () => {
    if (!confirm("New participant? This clears onboarding answers, the seed (new random content split), and ALL week transcripts on this device.")) return;
    Object.keys(localStorage).filter((k) => k.startsWith("clover-")).forEach((k) => {
      if (k !== CONFIG_KEY) localStorage.removeItem(k);
    });
    location.reload();
  });

  // The setup panel never opens on its own for participants — only via
  // the ⚙️ gear or a ?setup=1 URL (for the researcher).
  if (urlParams.get("setup")) {
    setTimeout(openSetup, 400);
  }

  // Exposed for debugging/verification only.
  window.__cloverSchedule = buildSchedule;

  main();
})();
