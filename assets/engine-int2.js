/* AYA-CHAT Clover — Interview 2 engine.
   Tests ONLY mood check-ins + text Exercise-of-the-Day prompts (no
   onboarding, no fun facts, no BA, no badges, no audio exercises).
   Flow per day: mood check-in -> scripted follow-up -> 1-2 rounds of
   active listening -> Exercise of the Day (scripted, with active
   listening after each answer). Week picked from the left panel first.
   Active listening uses the backend if it supports {action:"gemini"};
   otherwise warm scripted fallbacks keep the flow working.
*/
(function () {
  const C = window.CLOVER3;
  const BASE = window.CLOVER_BASE || "";
  const SESSION = "int2-" + new Date().toISOString().slice(5, 16).replace(/[-T:]/g, "") + "-" + Math.floor(100 + Math.random() * 900);

  /* Text exercises per week, in document order (no audio days). */
  const WEEK_DAYS = {
    1: [
      { label: "Savoring 1", ex: C.savoring.find((x) => x.week === 1 && x.n === 1) },
      { label: "Savoring 2", ex: C.savoring.find((x) => x.week === 1 && x.n === 2) },
      { label: "Gratitude 1", ex: C.gratitude.find((x) => x.week === 1 && x.n === 1) },
      { label: "Meaning 1", ex: C.meaning.find((x) => x.week === 1 && x.n === 1) }
    ],
    2: [
      { label: "Savoring 1", ex: C.savoring.find((x) => x.week === 2 && x.n === 1) },
      { label: "Gratitude 1", ex: C.gratitude.find((x) => x.week === 2 && x.n === 1) },
      { label: "Meaning 1", ex: C.meaning.find((x) => x.week === 2 && x.n === 1) },
      { label: "Meaning 2", ex: C.meaning.find((x) => x.week === 2 && x.n === 2) }
    ],
    3: [
      { label: "Savoring 1", ex: C.savoring.find((x) => x.week === 3 && x.n === 1) },
      { label: "Gratitude 1", ex: C.gratitude.find((x) => x.week === 3 && x.n === 1) },
      { label: "Meaning 1", ex: C.meaning.find((x) => x.week === 3 && x.n === 1) },
      { label: "Meaning 2", ex: C.meaning.find((x) => x.week === 3 && x.n === 2) }
    ],
    4: [
      { label: "Gratitude 1", ex: C.gratitude.find((x) => x.week === 4 && x.n === 1) },
      { label: "Gratitude 2", ex: C.gratitude.find((x) => x.week === 4 && x.n === 2) },
      { label: "Meaning 1", ex: C.meaning.find((x) => x.week === 4 && x.n === 1) },
      { label: "Meaning 2", ex: C.meaning.find((x) => x.week === 4 && x.n === 2) },
      { label: "Meaning 3 (Final Reflection)", ex: C.meaning.find((x) => x.week === 4 && x.n === 3) }
    ]
  };

  /* One-sentence active-listening mirror: reuses the participant's own
     words, acknowledges the emotion when applicable. The scripted message
     always follows it. Sent to the backend with the request so prompt
     tweaks need no backend redeploys. */
  const MIRROR_PROMPT = "You are Clover, a warm wellbeing chatbot for teen and young adult cancer survivors (ages ~15-29). The participant just answered a question. Reply with EXACTLY ONE short sentence of active listening that mirrors their own words back (reuse a phrase or detail they used, like a qualitative interviewer would - if they mention their dog, your sentence is about the dog) and, when the emotion is clear, acknowledges it (e.g. glad to hear you are excited). No questions. No advice. No new topics. Casual warm texting voice, at most one emoji, under 25 words. If they mention self-harm or crisis, instead respond with warmth and encourage them to contact their care team or call/text 988.";

  /* Small activity ideas for low moods, drawn from the daily-challenge bank. */
  const MOOD_SUGGESTIONS = [
    "putting on a song you love and just listening for a few minutes 🎶",
    "stepping outside for a couple minutes of fresh air 🌤️",
    "texting someone you've been meaning to catch up with 👋",
    "rewatching a favorite episode or scene 🍿",
    "making your favorite snack 🍳",
    "scrolling through photos that make you happy 📸",
    "taking a short walk with your top songs on 🎧",
    "doing one small thing you love, just because ❤️"
  ];



  let config = { logUrl: window.CLOVER_DEFAULT_LOG_URL || "" };
  const urlParams = new URLSearchParams(location.search);
  if (urlParams.get("log")) config.logUrl = urlParams.get("log");

  /* ================= Logging ================= */
  let transcript = [];
  const state = { dayNum: 0, phase: "boot", lastCloverRow: null, pendingInput: null, weekResolver: null };

  const remoteQueue = [];
  let remotePumping = false;
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

  function log(who, text, phase) {
    const entry = {
      t: new Date().toISOString(), seed: SESSION, week: state.week || 0,
      day: state.dayNum, phase: phase || state.phase, who, text
    };
    transcript.push(entry);
    if (config.logUrl) { remoteQueue.push(Object.assign({ action: "log" }, entry)); pumpRemote(); }
  }

  function downloadTranscript() {
    const stamp = new Date().toISOString().slice(0, 10);
    const q = (x) => '"' + String(x).replaceAll('"', '""') + '"';
    const lines = ["timestamp,session,week,day,phase,who,text"];
    transcript.forEach((r) => lines.push([r.t, r.seed, r.week, r.day, r.phase, r.who, r.text].map(q).join(",")));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    a.download = "chatlog_interview2_" + stamp + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /* ================= Active listening (AI with fallback) ================= */
  let fbIdx = 0;
  async function ai(question, answer) {
    if (config.logUrl) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        const res = await fetch(config.logUrl, {
          method: "POST",
          body: JSON.stringify({ action: "gemini", mode: "reflect", system: MIRROR_PROMPT, question, answer }),
          signal: controller.signal
        });
        clearTimeout(timer);
        const data = await res.json();
        if (data.ok && data.text) return data.text.trim();
        console.warn("AI backend has no gemini support yet — using fallback");
      } catch (e) { console.warn("AI unavailable, using fallback:", e); }
    }
    fbIdx = (fbIdx + 1) % C.fallbackReflections.length;
    return C.fallbackReflections[fbIdx];
  }

  async function aiSay(question, answer) {
    const typing = addTypingIndicator();
    const text = await ai(question, answer);
    typing.remove();
    addMessage(text, "received");
    log("clover", "[AI] " + text);
    await wait(500);
    return text;
  }

  /* ================= Chat UI ================= */
  const messagesArea = document.getElementById("messagesArea");
  const inputField = document.getElementById("inputField");
  const sendBtn = document.getElementById("sendBtn");
  const chatForm = document.getElementById("chatForm");
  const statusTime = document.getElementById("statusTime");
  const dateSep = document.getElementById("dateSep");
  const chipsBar = document.getElementById("chipsBar");

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

  function addMessage(text, side) {
    const row = document.createElement("div");
    row.className = "message-row " + (side === "sent" ? "sent" : "received");
    row.innerHTML = '<div class="bubble ' + (side === "sent" ? "sent" : "received") + '">' + escapeHtml(text) + "</div>";
    messagesArea.appendChild(row);
    if (side !== "sent") state.lastCloverRow = row;
    scrollToBottom();
    if (side === "sent") log("participant", text);
    return row;
  }

  function addSeparator(label) {
    const div = document.createElement("div");
    div.className = "date-sep";
    div.textContent = label;
    messagesArea.appendChild(div);
    scrollToBottom();
    log("clover", "[HEADER] " + label);
  }

  async function say(text, opts = {}) {
    const typing = addTypingIndicator();
    await wait(opts.typingMs ?? Math.min(900 + text.length * 12, 3000));
    typing.remove();
    const row = document.createElement("div");
    row.className = "message-row received";
    row.innerHTML = '<div class="bubble received">' + escapeHtml(text) + "</div>";
    messagesArea.appendChild(row);
    state.lastCloverRow = row;
    scrollToBottom();
    log("clover", text);
    await wait(opts.afterMs ?? 500);
  }

  async function pauseBeat(sec) {
    const typing = addTypingIndicator();
    await wait(sec * 1000);
    typing.remove();
  }

  function waitForUser(chips, opts = {}) {
    return new Promise((resolve) => {
      let idleTimer = null;
      const done = (val) => {
        if (idleTimer) clearTimeout(idleTimer);
        state.pendingInput = null;
        chipsBar.innerHTML = "";
        updateInputState(false);
        resolve(val);
      };
      state.pendingInput = done;
      if (opts.idleMs) idleTimer = setTimeout(() => done({ timeout: true, text: "" }), opts.idleMs);
      chipsBar.innerHTML = "";
      (chips || []).forEach((c) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip";
        btn.textContent = c.label;
        btn.addEventListener("click", () => {
          if (!state.pendingInput) return;
          addMessage(c.label, "sent");
          done({ text: c.value ?? c.label, chip: true });
        });
        chipsBar.appendChild(btn);
      });
      updateInputState(true);
      inputField.focus();
      scrollToBottom();
    });
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
    "skip", "switch", "don't want", "dont want", "not in the mood", "rather not", "pass"];
  const wantsSwap = (t) => SWAP_CUES.some((c) => String(t).toLowerCase().includes(c));

  const RISK_PATTERNS = [
    /kill(ing)?\s+(myself|me)/, /suicid/, /end(ing)?\s+my\s+life/, /want(ed)?\s+to\s+die/,
    /wanna\s+die/, /hurt(ing)?\s+myself/, /harm(ing)?\s+myself/, /self[\s-]?harm/,
    /cut(ting)?\s+myself/, /overdos/, /don'?t\s+want\s+to\s+(be\s+alive|live)/,
    /better\s+off\s+dead/, /end\s+it\s+all/, /no\s+reason\s+to\s+live/, /take\s+my\s+(own\s+)?life/
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

  function classifyMood(text, metaphor) {
    const n = String(text).toLowerCase();
    for (const o of metaphor.options) if (o.k.some((k) => n.includes(k))) return o.v;
    if (C.moodWordsNeg.some((w) => n.includes(w))) return "kneg";
    if (C.moodWordsPos.some((w) => n.includes(w))) return "kpos";
    return "neu";
  }

  const fillValues = (t) => String(t)
    .replaceAll("{V1}", "Self-Growth").replaceAll("{V2}", "Feeling Hopeful").replaceAll("{V3}", "Authenticity");

  /* Scripted exercise steps. After each participant answer: ONE AI
     mirror sentence, then the script continues (the sparkly closing stays
     scripted). No response for a while on the opening question -> offer
     the swap question; still nothing -> gentle close and move on. */
  const IDLE_FIRST_MS = 30000;   // opening question patience
  const IDLE_LATER_MS = 45000;   // later questions patience

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
      const reply = await waitForUser(chips, { idleMs: questionAsked ? IDLE_LATER_MS : IDLE_FIRST_MS });

      if (reply.timeout) {
        if (allowSwap && !questionAsked) return "swapped-idle";
        await say("It's okay — thank you for showing up today. We can leave it here. 💛", { typingMs: 900 });
        return "abandoned";
      }
      if (allowSwap && !questionAsked && (reply.text === "__swap__" || wantsSwap(reply.text))) {
        return "swapped";
      }
      questionAsked = true;
      const risky = await maybeRisk(reply.text);
      if (!risky && step.ask) await aiSay(q, reply.text);
    }
    return "done";
  }

  /* ================= One day: mood + exercise ================= */
  async function runDay(dayIdx, dayInfo) {
    state.dayNum = dayIdx + 1;
    addSeparator("Day " + (dayIdx + 1));

    // Mood check-in
    state.phase = "mood";
    const m = C.moodMetaphors[dayIdx % C.moodMetaphors.length];
    await say("How are you feeling today?\n\n" + m.options.map((o) => o.t + " – " + o.d).join("\n"));
    const moodReply = await waitForUser(m.options.map((o) => ({ label: o.t, value: o.t })));
    await maybeRisk(moodReply.text);
    const mood = classifyMood(moodReply.text, m);
    log("clover", "[MOOD=" + mood + "]");

    if (mood === "neu") {
      await say(pick(C.ackNeu));
    } else if (mood === "pos" || mood === "kpos") {
      // Follow-up -> one AI mirror sentence -> scripted validation.
      await say(pick(C.moodFollowPos));
      const r = await waitForUser();
      const risky = await maybeRisk(r.text);
      if (!risky) {
        await aiSay("What made your day good?", r.text);
        await say(pick(C.ackPos));
      }
    } else {
      // Low mood: follow-up -> AI mirror -> small suggestions from the
      // challenge bank -> scripted validation.
      await say(pick(C.moodFollowNeg));
      const r = await waitForUser();
      const risky = await maybeRisk(r.text);
      if (!risky) {
        await aiSay("What would help today feel a little better?", r.text);
        const ideas = shuffledPair(MOOD_SUGGESTIONS);
        await say("If it helps, here are a couple of small things you could try: " + ideas[0] + ", or " + ideas[1], { typingMs: 1100 });
        await say(pick(C.ackNeg));
      }
    }

    // Exercise of the day
    state.phase = "intervention";
    addSeparator("🧘 Exercise of the Day 💭");
    log("clover", "[INTERVENTION " + dayInfo.label + "]");
    const canSwap = !!dayInfo.ex.swap;
    const result = await runSteps(dayInfo.ex.def, canSwap);
    if (result === "swapped" || result === "swapped-idle") {
      await say(result === "swapped-idle"
        ? "No rush at all — how about a different question instead? 😊"
        : "No problem at all! Let's try this one instead 😊", { typingMs: 800 });
      log("clover", "[SWAPPED" + (result === "swapped-idle" ? " (no response)" : "") + "]");
      const second = await runSteps(dayInfo.ex.swap, false);
      if (second === "abandoned") return;
    }
  }

  function shuffledPair(arr) {
    const a = arr.slice();
    const i = Math.floor(Math.random() * a.length);
    const first = a.splice(i, 1)[0];
    const second = a[Math.floor(Math.random() * a.length)];
    return [first, second];
  }

  /* ================= Week panel + main ================= */
  function buildPanel() {
    const panel = document.createElement("div");
    panel.className = "test-controls";
    panel.innerHTML = '<div class="test-controls-title">🍀 Clover<span>Interview 2</span></div>';
    for (let w = 1; w <= 4; w++) {
      const b = document.createElement("button");
      b.textContent = "Week " + w;
      b.addEventListener("click", () => {
        if (!state.weekResolver) { alert("Please finish the current day first 😊"); return; }
        const r = state.weekResolver;
        state.weekResolver = null;
        r({ type: "week", week: w });
      });
      panel.appendChild(b);
    }
    const dl = document.createElement("button");
    dl.className = "new-tester";
    dl.textContent = "⬇️ Download log";
    dl.addEventListener("click", downloadTranscript);
    panel.appendChild(dl);
    document.body.appendChild(panel);
  }

  function boundary(label) {
    return new Promise((resolve) => {
      let wrap = null;
      state.weekResolver = (val) => { if (wrap) wrap.remove(); resolve(val); };
      if (label) {
        wrap = document.createElement("div");
        wrap.className = "day-btn-wrap";
        const btn = document.createElement("button");
        btn.className = "day-btn";
        btn.textContent = label;
        btn.addEventListener("click", () => {
          wrap.remove();
          state.weekResolver = null;
          resolve({ type: "continue" });
        });
        wrap.appendChild(btn);
        messagesArea.appendChild(wrap);
        scrollToBottom();
      }
    });
  }

  async function main() {
    updateStatusTime();
    setInterval(updateStatusTime, 30000);
    autosizeInput();
    updateInputState(false);
    buildPanel();

    await wait(400);
    await say("Hi! This is the Clover interview session 🍀 Pick a week on the left to begin.", { typingMs: 1200 });

    let nextWeek = null;
    while (true) {
      if (nextWeek === null) nextWeek = (await boundary(null)).week;
      const w = nextWeek;
      nextWeek = null;
      state.week = w;
      addSeparator("Week " + w);
      const days = WEEK_DAYS[w];
      for (let i = 0; i < days.length; i++) {
        await runDay(i, days[i]);
        if (i < days.length - 1) {
          const choice = await boundary("Continue to Day " + (i + 2) + " →");
          if (choice.type === "week") { nextWeek = choice.week; break; }
        }
      }
      if (nextWeek === null) {
        await say("That's all of Week " + w + "'s check-ins and exercises! Pick a week on the left to run another. 💛", { typingMs: 900 });
      }
    }
  }

  main();
})();
