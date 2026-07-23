/* AYA-CHAT Clover — content bank v2 (interview + pilot)
   Sources (verbatim): "AYAC Intervention Content Master.docx" (KS 7.17.2026)
                       "Chatbot Example Visuals (3).docx"
   Step format:
     "text"          -> Clover bubble
     {ask:"text"}    -> bubble, wait for reply, then (AI) active-listening reflection
     {askNR:"text"}  -> bubble, wait for reply, NO reflection
     {pause:10}      -> real wait with typing bubble shown
   Final "✨..." string is the scripted closing line.
*/
window.CLOVER2 = (function () {

  /* ============ Greetings (15 consistent) ============ */
  const greetings = [
    "Hey", "Hello again 🌤️", "Just checking in ~", "Hi there 🌱",
    "Hello, thanks for checking in 🌱", "👋", "Hey theree 👋", "Welcome back 🌼",
    "Hi, popping in to say hello 👋", "Happy to see you!", "Hi! Glad you're here 😊",
    "Happy you stopped by", "Glad you're here 💛", "Heyyy, welcome back ✨",
    "Heyyy, good to see you again 👋"
  ];

  /* ============ Mood monitoring (7 metaphors, 5 levels) ============
     valence: pos | kpos | neu | kneg | neg */
  const moodMetaphors = [
    { name: "weather", options: [
      { t: "☀️ Sunny", d: "Positive mood", v: "pos", k: ["sunny"] },
      { t: "🌤️ Partly Sunny", d: "Kind of positive mood", v: "kpos", k: ["partly"] },
      { t: "☁️ Cloudy", d: "Neutral mood", v: "neu", k: ["cloud"] },
      { t: "🌧️ Rainy", d: "Kind of negative mood", v: "kneg", k: ["rain"] },
      { t: "⛈️ Stormy", d: "Negative mood", v: "neg", k: ["storm"] }
    ]},
    { name: "traffic", options: [
      { t: "🛣️✨ Open Highway", d: "Positive mood", v: "pos", k: ["highway", "open"] },
      { t: "🚘 Smooth Ride", d: "Kind of positive mood", v: "kpos", k: ["smooth"] },
      { t: "🛣️ Steady Drive", d: "Neutral mood", v: "neu", k: ["steady"] },
      { t: "🚦 Slow Traffic", d: "Kind of negative mood", v: "kneg", k: ["slow"] },
      { t: "🚗🚗🚗 Traffic Jam", d: "Negative mood", v: "neg", k: ["jam"] }
    ]},
    { name: "battery", options: [
      { t: "⚡ Fully Charged", d: "Positive mood", v: "pos", k: ["fully"] },
      { t: "🔋◼️ Almost Charged", d: "Kind of positive mood", v: "kpos", k: ["almost"] },
      { t: "🔋◻️ Half Charged", d: "Neutral mood", v: "neu", k: ["half"] },
      { t: "🔋 Low Battery", d: "Kind of negative mood", v: "kneg", k: ["low"] },
      { t: "🪫 Completely Drained", d: "Negative mood", v: "neg", k: ["drain"] }
    ]},
    { name: "cup", options: [
      { t: "☕✨ Overflowing", d: "Positive mood", v: "pos", k: ["overflow"] },
      { t: "☕ Full", d: "Kind of positive mood", v: "kpos", k: ["full"] },
      { t: "☕ Half Full", d: "Neutral mood", v: "neu", k: ["half full"] },
      { t: "☕ Half Empty", d: "Kind of negative mood", v: "kneg", k: ["half empty"] },
      { t: "☕ Empty", d: "Negative mood", v: "neg", k: ["empty"] }
    ]},
    { name: "game", options: [
      { t: "🟢 Winning / In the Zone", d: "Positive mood", v: "pos", k: ["winning", "zone"] },
      { t: "🟡 Doing Good", d: "Kind of positive mood", v: "kpos", k: ["doing good"] },
      { t: "⚪ Just Playing", d: "Neutral mood", v: "neu", k: ["just playing", "playing"] },
      { t: "🟠 Struggling", d: "Kind of negative mood", v: "kneg", k: ["struggl"] },
      { t: "🔴 Game Over Energy", d: "Negative mood", v: "neg", k: ["game over"] }
    ]},
    { name: "music", options: [
      { t: "🎶 This My Jam!", d: "Positive mood", v: "pos", k: ["jam"] },
      { t: "🎧 Vibing", d: "Kind of positive mood", v: "kpos", k: ["vib"] },
      { t: "🔊 I'll Let It Play", d: "Neutral mood", v: "neu", k: ["let it play"] },
      { t: "🔉 Meh", d: "Kind of negative mood", v: "kneg", k: ["meh"] },
      { t: "🔇 Skippp", d: "Negative mood", v: "neg", k: ["skip"] }
    ]},
    { name: "ocean", options: [
      { t: "🌊 Calm Waves", d: "Positive mood", v: "pos", k: ["calm"] },
      { t: "🌅 Gentle Waves", d: "Kind of positive mood", v: "kpos", k: ["gentle"] },
      { t: "🪨 Still Water", d: "Neutral mood", v: "neu", k: ["still"] },
      { t: "🌧️ Choppy Water", d: "Kind of negative mood", v: "kneg", k: ["choppy"] },
      { t: "🌪️ Rough Storm", d: "Negative mood", v: "neg", k: ["rough", "storm"] }
    ]}
  ];

  const moodWordsPos = ["good", "great", "happy", "excited", "amazing", "awesome", "fantastic", "positive", "well", "better", "hopeful", "nice"];
  const moodWordsNeg = ["bad", "sad", "tired", "hard", "awful", "anxious", "stressed", "down", "rough", "negative", "terrible", "exhausted", "not good", "not great"];
  const moodWordsNeu = ["ok", "okay", "fine", "neutral", "normal", "alright", "so-so", "meh", "middle"];

  const moodFollowPos = [
    "Is there anything that's making your day good 😊",
    "What's made today great so far? 😊",
    "Is there a highlight from your day so far? 😊",
    "What was your favorite part of your day so far? 😊",
    "What's putting a smile on your face today? 😊"
  ];
  const moodFollowNeg = [
    "Is there a small thing you can think of to do that would help?",
    "What could you do to make today a little bit better?",
    "What's one small thing you could do to brighten your day?",
    "Can you think of something that might help you feel a little better?",
    "Can you think of something to do that usually helps you feel better?"
  ];

  const ackPos = [
    "That's so good to hear. You deserve days that feel this way 💛",
    "You're doing really well. Keep going, you've got this.",
    "Good days are worth celebrating, even the small ones 🌟",
    "Whatever you did to get here, it's working. YAY! 💛",
    "Yes! A good day deserves to be noticed. Give yourself a pat on the back! 🌟",
    "Feeling good looks good on you 🪞🌟",
    "It's okay to enjoy the good days without waiting for something to go wrong.",
    "You're allowed to feel strong and hopeful 💪",
    "Notice what feels good right now — you helped create that ✨",
    "You're creating moments worth celebrating. Keep it up! 🌟",
    "Take a second to soak up this good feeling ✨",
    "You gave yourself something to feel proud of today 🌟",
    "Celebrate this moment. You deserve to feel good about it 💛",
    "That's the kind of energy we love to see! 🌞",
    "I'm so glad today has brought you something to smile about 😊"
  ];
  const ackNeu = [
    "Some days are just middle-of-the-road and that's completely normal. You're doing fine.",
    "Coasting days are rest days in disguise. Give yourself some grace today 🌿",
    "Hey, okay is okay. Not every day has to be amazing — and that's totally fine 💛",
    "It's okay to feel \"in between.\" Not every day has to be big.",
    "Steady is still progress.",
    "You don't have to force yourself to feel more than you do.",
    "Sometimes stability is the quiet win.",
    "Today feels steady — and steady days are part of a good rhythm.",
    "You don't need a big shift for today to be meaningful.",
    "There's value in a day that feels ordinary.",
    "Not every day has to shift you forward noticeably to matter.",
    "You're maintaining, and maintenance is part of progress.",
    "There's no pressure for today to be anything more than it is.",
    "This kind of day gives everything else room to breathe.",
    "Today doesn't need to stand out to still matter.",
    "There's nothing wrong with a day that just flows gently.",
    "You're keeping things balanced, even if it doesn't feel notable."
  ];
  const ackNeg = [
    "I'm really glad you checked in, especially on a hard day.",
    "Hard feelings don't mean you're failing 💙",
    "You're allowed to have tough days without judging yourself for them. 🌿",
    "Thank you for being honest about how you're feeling. That takes courage 💙",
    "Low days don't last forever, even when it feels like they will. You've gotten through hard days before 💛",
    "Whatever you're carrying right now, you don't have to carry it perfectly. Just take it one moment at a time 🌿",
    "You matter on your hard days just as much as your good ones 💙",
    "It's okay to rest. It's okay to feel this. And it's okay to ask for support when you need it",
    "We're really glad you're here today. Even on the tough days — especially on the tough days 💛"
  ];

  /* ============ Fun facts — fixed by day (28) ============ */
  const funFacts = [
    { d: 1, type: "s", text: "Your brain creates enough electricity to power a lightbulb 💡. So... yeah, you're pretty electric." },
    { d: 2, type: "t", q: "🤔 Quick question before we start... How do otters sleep without drifting away from each other?\n\nA) They tie their tails together\nB) They hold hands\nC) They sleep on land\nD) They don't sleep, ever",
      a: "Answer: B! Otters hold hands while sleeping so they don't float apart. Isn't that pretty cute! 🦦" },
    { d: 3, type: "s", text: "Sunlight triggers serotonin (the happy hormone), but so does remembering sunlight. Wild, right?" },
    { d: 4, type: "t", q: "🤔 What is a group of flamingos called?\n\nA) A flock\nB) A flutter\nC) A flamboyance\nD) A flamingle",
      a: "Answer: C! A flamboyance. They knew what they were lol 🦩" },
    { d: 5, type: "s", text: "Wombat poop is cube-shaped, which helps it from rolling away when they mark their territory." },
    { d: 6, type: "t", q: "🤔 True or False: It is physically impossible to hum while holding your nose.",
      a: "Answer: TRUE! Go on, try it. We caught you. 😂" },
    { d: 7, type: "s", text: "A group of pandas is called an \"embarrassment.\"" },
    { d: 8, type: "t", q: "🤔 Which one is actually a berry?\n\nA) Strawberry 🍓\nB) Raspberry\nC) Banana 🍌\nD) None of them",
      a: "Answer: C! Bananas are berries. Strawberries are NOT. Mindblowing 🤯" },
    { d: 9, type: "s", text: "Saturn could technically float on water. Now we just need a big enough bathtub 🪐🛁" },
    { d: 10, type: "t", q: "🤔 What is Scotland's national animal?\n\nA) A stag\nB) A golden eagle\nC) A unicorn\nD) A highland cow",
      a: "Answer: C! Scotland said \"we want a unicorn 🦄\" and nobody stopped them lolol" },
    { d: 11, type: "s", text: "Some turtles can breathe through their butts when hibernating underwater. Lucky them. 🐢" },
    { d: 12, type: "t", q: "🤔 True or False: A bolt of lightning is hotter than the surface of the sun. ⚡",
      a: "Answer: TRUE! Lightning is about 5x hotter. Crazy!" },
    { d: 13, type: "s", text: "Crows can recognize individual human faces and hold onto that memory for years. Somewhere out there a crow thinks about you... let that sink in... 🐦‍⬛💭" },
    { d: 14, type: "t", q: "🤔 Quick question, which one is older, sharks 🦈 or trees 🌲?",
      a: "Answer: SHARKS! Sharks have been around for ~450 million years. Trees showed up ~350 million years ago. Sharks were here first." },
    { d: 15, type: "s", text: "The Mona Lisa has no eyebrows. Nobody knows why. 🤨" },
    { d: 16, type: "t", q: "🤔 True or False: Oxford University is older than the Aztec Empire. 🏛️",
      a: "Answer: TRUE! Oxford started teaching around 1096. The Aztec Empire began around 1428. Oxford University is literally ancient." },
    { d: 17, type: "s", text: "Koalas have fingerprints almost identical to humans, close enough to occasionally confuse a crime scene. 🐨🚨" },
    { d: 18, type: "t", q: "🤔 What percentage of your DNA do you share with a banana? 🍌\n\nA) 0%\nB) 10%\nC) 50%\nD) 60%",
      a: "Answer: D! Humans share about 60% of their DNA with bananas. We don't talk about this enough." },
    { d: 19, type: "s", text: "Certain species of frogs can survive being frozen solid through winter — heart stopped completely — then thaw out in spring and hop away like nothing happened 🐸🧊" },
    { d: 20, type: "t", q: "🤔 Which animal has three hearts?\n\nA) Shark\nB) Octopus\nC) Dolphin\nD) Jellyfish",
      a: "Answer: B! Octopuses have three hearts — two pump blood to the gills, and one pumps it to the rest of the body." },
    { d: 21, type: "s", text: "Napoleon was the average height for his era — British cartoonists were just messing with him. Historically one of the most legendary trolls 😭" },
    { d: 22, type: "t", q: "🤔 True or False: Spotify's original name was almost \"Soundify.\" 🎧",
      a: "Answer: TRUE! Spotify founders considered other names before settling on the name we know today." },
    { d: 23, type: "s", text: "Emperor penguins huddle in a rotating circle in Antarctic storms, so every penguin gets a turn in the warm center. Nobody's stuck on the outside the whole time 🐧" },
    { d: 24, type: "t", q: "🤔 Which animal is known for having the ability to sleep while one half of its brain rests? 🐬\n\nA) Dolphin\nB) Dog\nC) Elephant\nD) Rabbit",
      a: "Answer: A! Dolphins can rest one half of their brain at a time so they can continue surfacing for air." },
    { d: 25, type: "s", text: "On Neptune it actually rains diamonds. Makes you think if it really does rain cats and dogs somewhere 🙀🐶" },
    { d: 26, type: "t", q: "🤔 Which animal sleeps the most hours per day? 😴\n\nA) Dog\nB) Koala\nC) Lion\nD) Dolphin",
      a: "Answer: B! Koalas can sleep up to around 20 hours a day. Their schedule is basically snack, nap, repeat 🐨." },
    { d: 27, type: "s", text: "One Day on Venus is longer than one year on Venus. This is what I mean when I say I'll do it tomorrow 🤣" },
    { d: 28, type: "s", text: "🍀 Final fun fact: Four leaves are a genetic mutation, and each leaflet represents a different value according to old Irish folklore: luck, love, faith, and hope! 🍀" }
  ];

  const funFactTapbacks = [
    "Give a thumbs up, if you learned something new",
    "React with a heart, if this fun fact made you smile",
    "Thumbs up this message, if you were surprised by this fact",
    "React with an emoji that sums up this fun fact",
    "Give a heart, if you enjoyed this fun fact",
    "Give a thumbs up, if you want more fun facts like this",
    "React with a heart, if you would share this fun fact with a friend.",
    "React with a heart, if this fun fact made your day a little brighter",
    "React with an exclamation mark, if you were today's years old when you learned this.",
    "Give a thumbs up, if you already knew this fact!",
    "React with a 🤣, if this fun fact made you laugh"
  ];

  const audioTapbacks = [
    "Thumbs up this message if you made it through the whole practice",
    "React with 👍 if you tried this practice",
    "React with 👍 if you're glad you showed up for yourself",
    "Give a 👍 if you stayed present (even if it was hard)",
    "Give a thumbs up if you noticed tension you didn't realize was there",
    "React with 👍 if you feel a little more grounded",
    "Give a heart if you feel a little calmer now",
    "Thumbs up this message if you noticed your breathing shift",
    "React with an emoji that describes how you feel after the practice",
    "React with an emoji that sums up how that felt"
  ];

  const swapReminders = [
    "Reminder: If you want a different question, that's totally cool! Just let me know, I got another one in mind.",
    "Reminder: Let me know if you want to swap the question",
    "Reminder: If this question isn't your vibe today, we can try something else.",
    "Reminder: We can always try a different question, no pressure.",
    "Reminder: You can absolutely swap this with another question — I won't take it personally 😆"
  ];

  /* ============ Risk detection ============ */
  const riskKeywords = [
    "kill myself", "suicide", "suicidal", "end my life", "want to die", "wanna die",
    "hurt myself", "harm myself", "self harm", "self-harm", "cutting myself",
    "don't want to be alive", "dont want to be alive", "not want to live",
    "better off dead", "end it all", "no reason to live", "take my own life",
    "overdose", "kill me"
  ];
  const riskResponse = "Thank you for telling me. Your well-being is important. I encourage you to reach out to a mental health professional, your healthcare team, or someone you trust for support.\n\nRemember: Clover is not monitored in real time and cannot provide emergency or crisis support. If you're experiencing a medical or mental health emergency, contact your healthcare team, call emergency services, or seek immediate in-person care. If you feel you may be in immediate danger or are unable to keep yourself safe, call 911 (or your local emergency services) or go to the nearest emergency department. If you're in the United States or Canada, you can also call or text 988 to reach the Suicide & Crisis Lifeline.";

  /* ============ Onboarding options ============ */
  const onboardingIntro = "Hi, I'm Clover! We will be doing a 28-day positive psychology program together. I'll check in every day, ask questions, and suggest activities for you to do. Our daily check-ins will follow the same general flow, but I'll share different Questions of the Day and Daily Challenges. I'd like to start with some getting to know you questions.";

  const interests = [
    "Sports", "Reading", "Baking", "TV", "Video games", "Fashion",
    "Writing/journaling", "Photography", "Podcasts", "Playing Musical Instruments",
    "Plants", "Makeup/Beauty", "Fitness"
  ];

  const values = [
    { name: "Self-Growth", def: "to keep changing and growing" },
    { name: "Feeling Hopeful", def: "to maintain a positive and optimistic outlook" },
    { name: "Feeling Loved", def: "to be loved by those close to me" },
    { name: "Sense of Purpose", def: "to have a meaning and direction in my life" },
    { name: "Safety and Security", def: "to be safe and secure" },
    { name: "Caring for Others", def: "to take care of others" },
    { name: "Authenticity", def: "to act in a manner that is true to who I am" },
    { name: "Self-Acceptance", def: "to accept (love) myself as I am" }
  ];

  /* ============ Badges — fixed by day ============ */
  const badges = [
    "Started the Journey 🌱", "New Thing, Who Dis 🆕", "Said Something Nice About Life ✨",
    "Emotions? Faced 💪😤", "Didn't Ghost the Chatbot Badge 👻💬", "Task: Unboxed. Vibes: refreshed 📦",
    "Emotional Forecast: Good Vibes Incoming 🌈☀️", "Answered Honestly 💭", "Emotional Acrobat 🎪",
    "Looked Inward, Didn't Panic 🪞", "That's a wrap. Great scene, great work 🎬", "I Showed Up 🫶",
    "Building Momentum 🚀", "Sat With It 🧘", "Feelings: Acknowledged 🫡", "Finding My Flow 🌊",
    "Slowed Down for a Sec 🐢", "Finding My Pace 🛤️", "Chose Optimism (Today, At Least) 🌻",
    "Mindful-ish 🍃", "Personal growth watered 🪴", "Crowned CEO of self-care today 👑",
    "Kept Showing Up ✨", "Peace Mode Activated 🕊️", "Emotional Inbox: Cleared 📭",
    "Grounded and Glowing 🌍✨", "Embraced the Human Moments 🫀"
  ];
  const day28BadgeIntro = "Congratulations on completing the 28-day wellness program! I want to award you a badge that's just as special as you are!";
  const day28Badge = "The Clover Badge 🍀: A four leaf clover is one among 10,000 clovers. One thing it represents is luck, but through these 28 days you showed that you don't need luck to take care of yourself, and I'm so proud of your efforts! 🍀";

  /* ============ Affirmations (bank carried over from 7.13 content set —
     new docs don't include an affirmation list) ============ */
  const affirmations = [
    "🎯 You aimed. You focused. You finished. Mic drop.",
    "🎉 That was a whole little moment. You did that.",
    "🧘 Mind = calmed. Task = crushed.",
    "📩 Emotions? Processed. Like a pro.",
    "🥲 Somehow... that was both deep and delightful.",
    "🪩 Another reflective icon moment unlocked.",
    "🥂 Cheers to you and that completed task.",
    "📅 You made time for you — and that's a power move.",
    "💪 That was a rep in your emotional gym. Strong stuff.",
    "🎯 You aimed inward and hit the target. Respect.",
    "💌 Self-check-in: complete. Sanity: slightly restored.",
    "🥇 Not every win needs confetti, but you earned some.",
    "🧼 That was like a brain shower. Clean and clear.",
    "🫧 Lightly cleansed your soul today. We love to see it.",
    "🏁 Task finished. Energy protected. Growth secured.",
    "🥽 You dove in and didn't flinch. Brave stuff.",
    "📦 Task: unboxed. Vibes: refreshed.",
    "🎬 That's a wrap. Great scene, great work.",
    "🕯 You lit a little light today. Now everything's a little brighter.",
    "🌱 Proof of growth. Even on hard days.",
    "✨ You showed up. And honestly, that's the hardest part sometimes.",
    "🫶 You checked in with yourself. That's real self-care.",
    "🪴 Personal growth watered. Your inner plant says thanks.",
    "🌤 Storm survived. Another day moving forward.",
    "👑 Crowned yourself CEO of self-care today.",
    "🧩 Puzzle pieces of your emotions: clicked together.",
    "🍕 Self-reflection slice served. Fresh out of the emotional oven.",
    "🌯 Wrapped up today's feelings like a well-built burrito. Balanced."
  ];

  /* ============ Behavioral Activation — generic, fixed by day (28) ============ */
  const baGeneric = [
    { ch: "Daily challenge: Spend some time doing something you love, not because it is productive, but because you enjoy it ❤️",
      checkin: "What was the thing you love that you ended up doing? What makes you enjoy it?",
      done: "Doing something purely because you love it is one of the best uses of time there is. Glad you made room for it",
      notDone: "That's okay, whenever you get some down time, try this again." },
    { ch: "Daily challenge: Send someone a song that reminds you of them 🎶",
      checkin: "Did you send someone a song? What made you think of them?",
      done: "Songs are such a specific way to say 'I was thinking of you' without needing extra words. Nice one.",
      notDone: "Don't sweat it, you can always pick a song when you're up for it!" },
    { ch: "Daily challenge: Play a fun game you haven't touched in a while 🕹️🧩🎲",
      checkin: "Did you dust off an old favorite game? How was it going back to something familiar?",
      done: "Revisiting something familiar definitely hits, brings you back to a different time",
      notDone: "No big deal! Pick up that game another time 😊" },
    { ch: "Daily challenge: Give yourself a genuine compliment today — reflect on something you're proud of 💛",
      checkin: "Did you say something nice to yourself? Do you feel comfortable sharing it?",
      done: "Saying something genuinely kind about yourself isn't always easy, but it is meaningful.",
      notDone: "No worries, you can give yourself a compliment when you feel ready." },
    { ch: "Daily challenge: Make your favorite snack or meal today and take your time enjoying the process 🍳",
      checkin: "What favorite food did you make? How did it turn out?",
      done: "Taking some me-time to prepare and eating something you enjoy, that's a win",
      notDone: "That meal will still be waiting for when you and your stomach are ready" },
    { ch: "Daily challenge: Make a playlist with a theme — late night drive, rainy day, movie montage, anything 🚗",
      checkin: "What was the theme you went with for your playlist? What inspired you?",
      done: "A themed playlist takes a lot of thought, pretty cool that you were able to do it.",
      notDone: "No rush, even brainstorming a theme and some favorite songs is a step towards completing this challenge." },
    { ch: "Daily challenge: Make a list of your \"favorites\": could be favorite songs, places, people, meals, memories, games, moments in your day",
      checkin: "What favorite things did you make a list of? Tell me some of the highlights",
      done: "There's something wonderful about putting down your favorite things in writing",
      notDone: "Whenever you're ready to make that list, all the things are already in your head" },
    { ch: "Daily challenge: Step outside and see if you can spot three different plants, birds, or insects, and find out what they are online. 🐦🐜🌺",
      checkin: "Did you get the chance to find out the names of the co-habitants of your environment? Did any of them surprise you?",
      done: "There are lots of things out in nature that we see every day but don't actually know much about them — not even their names!",
      notDone: "Fortunately, a lot of nature around us sticks around, so you can look for those birds, plants, or ants whenever you're ready!" },
    { ch: "Daily challenge: Open your camera roll and favorite 5 photos that make you happy 📸",
      checkin: "Tell me about your favorite photos from your camera roll. What was special about the ones you chose?",
      done: "Sounds like a nice little scroll down memory lane",
      notDone: "Those photos aren't going anywhere, scroll down memory lane whenever you're ready" },
    { ch: "Daily challenge: Spend 5 minutes sitting somewhere that makes you feel peaceful and calm and enjoy a quiet moment 🌤️",
      checkin: "How did the quiet moment sitting somewhere peaceful go?",
      done: "Being still and doing absolutely nothing is an underrated activity, glad you gave it a chance",
      notDone: "That's OK, try to make time for that quiet moment today even if it's just for a few minutes" },
    { ch: "Daily challenge: Reach out to a friend who shares some of the same interests and make plans to hang out! 📲",
      checkin: "Did you reach out and make plans with a friend?",
      done: "It's always fun to hang out with someone who gets you!",
      notDone: "No worries, you can make plans another time." },
    { ch: "Daily challenge: Leave a kind note to yourself, somewhere you'll see later 💌",
      checkin: "Did you get a chance to write a kind note for yourself? Tell me anything you feel comfortable sharing.",
      done: "Way to spend a moment practicing self-appreciation",
      notDone: "Don't sweat it, being kind to yourself doesn't have a deadline" },
    { ch: "Daily challenge: Take a walk listening to your top three songs of the week 🎧",
      checkin: "How was your walk? What songs did you listen to?",
      done: "Walking while listening to some awesome music is a real mood boost!",
      notDone: "Those songs will be waiting for you to hit play, no rush on the walk." },
    { ch: "Daily challenge: Make a small \"try later\" list — a café, recipe, event, or new experience 🌱",
      checkin: "What did you add to the try later list?",
      done: "Having a list of things to look forward to sounds like an awesome list",
      notDone: "No worries — some days thinking about new things just isn't the vibe." },
    { ch: "Daily challenge: Pick a small task you've been avoiding for a while and just get started on it. No pressure to finishing it. 🏁",
      checkin: "Did you get started on that task you've been avoiding? How did it go?",
      done: "It feels nice to make headway on something that's been on the to-do list for a long time.",
      notDone: "The task can sit on your to-do list a little longer, work on it when you can." },
    { ch: "Daily challenge: Spend some time tidying your room ✨",
      checkin: "Did your space get a refresh? What did you tidy up?",
      done: "A tidier space has a bigger impact than most people would think",
      notDone: "The space will still be there later, probably still in need of some tidying" },
    { ch: "Daily Challenge: look up something that you've been really curious about 💻",
      checkin: "What was something you're curious about that you looked up? What did you learn?",
      done: "Curiosity is always something worth exploring, there's always room for wonder!",
      notDone: "Curiosity is what keeps our minds churning so it's important to indulge when you have time" },
    { ch: "Daily challenge: Treat yourself with your favorite meal today",
      checkin: "What was the meal you treated yourself to?",
      done: "Way to treat yourself, there doesn't need to be a special occasion to do nice things for yourself",
      notDone: "There's no deadline to treat yourself, it's always going to wait for you" },
    { ch: "Daily challenge: Go somewhere nearby you've never actually taken time to explore 🚶",
      checkin: "Where's the new place you explored? Was it worth the trip?",
      done: "Sometimes the coolest things can be right under our noses",
      notDone: "You can go another time when curiosity strikes" },
    { ch: "Daily challenge: Send someone a meme that you thought was funny",
      checkin: "Did you send a meme to your friend? What'd they think?",
      done: "Sharing something that made you laugh is a nice gift. Glad you passed it on.",
      notDone: "All good, share the next funny meme you come across!" },
    { ch: "Daily challenge: Reach out and make plans with someone this weekend. 📅",
      checkin: "Just wanted to ask if you ended up making any weekend plans? 🗓️",
      done: "Way to go! Create new moments with people who matter to you.",
      notDone: "No stress, you can always try again next weekend." },
    { ch: "Daily challenge: Rewatch a favorite movie or episode that always makes you smile 🍿",
      checkin: "What'd you end up rewatching? Did it hit the way you remembered?",
      done: "There's something so comforting about rewatching a movie or TV show you already know by heart — glad you gave yourself that.",
      notDone: "That rewatch will be just as good whenever you actually get to it — some comfort doesn't expire." },
    { ch: "Daily challenge: Organize one thing. It could be a drawer, your desk, or your phone home screen. Small wins count! ⭐️",
      checkin: "What'd you get organized? Does it feel better to have it out of the way? 😌",
      done: "One less messy thing to think about — incredible relief",
      notDone: "Hitting pause today is fine too, you can always try this again later." },
    { ch: "Daily challenge: Try something new - it could be food, a coffee shop or restaurant, an activity. 🎉",
      checkin: "What was the new thing you ended up trying? Would you do it again?",
      done: "Whether it was a new favorite or great story for later, trying is a win",
      notDone: "That is 100% okay — new adventures can wait." },
    { ch: "Daily challenge: Text someone you've been meaning to catch up with 👋",
      checkin: "Did you get a chance to text someone to catch up? How'd it go — or if not, what got in the way? 🤔",
      done: "Reaching out isn't always easy, so I'm glad you followed through and made it happen",
      notDone: "That's okay — you can reach out another time." },
    { ch: "Daily challenge: Make something small - a doodle, a playlist, a simple snack, anything. Just create for a few minutes 🎨",
      checkin: "Hey Picasso, did you get the chance to make something? 👩‍🎨",
      done: "Regardless of whether or not it is worthy of being in a gallery, you made something that didn't exist before. I think that's cool",
      notDone: "The creative canvas in your brain is waiting until you can put it down!" },
    { ch: "Daily challenge: Listen to one song you've never heard before. Any genre, any era 🎧",
      checkin: "What song did you end up playing? Was it 🔥",
      done: "Can't find a hidden gem without looking, always worth exploring new music.",
      notDone: "You can circle back to that new song when you can." },
    { ch: "Final Challenge: Do one thing today that feels like celebrating — however big or small that might look! 🎉",
      checkin: "", done: "", notDone: "" }
  ];

  /* ============ Behavioral Activation — interest-tailored (13) ============ */
  const baTailored = {
    "Sports": { ch: "Daily challenge: Watch a game of your favorite team, watch some highlights, or if you're able to, bust out some of your favorite athletes most iconic moves 🏂",
      checkin: "Did you catch the game or any highlights? Did you hit any moves? ⛹️",
      done: "Love to see it! Taking time to enjoy the sports you love is a great way to fuel your own strength",
      notDone: "No worries, even the best athletes have to sit on the bench to rest up" },
    "Reading": { ch: "Daily challenge: Read a chapter of the book you're into right now — and if you're between books, spend a few minutes googling your next read. 📚",
      checkin: "Did you get a chance to read, or find something new to the list?",
      done: "There is honestly nothing better than getting lost in a good chapter or finding a new book to look forward to",
      notDone: "The pages aren't going anywhere. You can jump into a new book whenever you're ready!" },
    "Baking": { ch: "Daily Challenge: Bake something today — even if it's just box brownies, bonus points if it's something new. 🎂",
      checkin: "What did you end up baking? Was it delicious?",
      done: "Hopefully you got to enjoy a delicious reward",
      notDone: "That's alright, some days are for baking some days for well-deserved rest" },
    "TV": { ch: "Daily Challenge: Watch an episode of your current show or rewatch something you already love. If you're rewatching, keep track of how much dialogue you can quote. 🎥🎬",
      checkin: "What'd you watch? And if it was a rewatch, was that show as good as you remember?",
      done: "Hopefully you got a little escape into a new world",
      notDone: "That watchlist isn't going anywhere, press play when you're ready!" },
    "Video games": { ch: "Daily Challenge: Play a level, get a win, finish a quest, or boot up a favorite game you haven't touched in a while and see how you left off 🎮",
      checkin: "How was the gaming sesh — rage-inducing or chill?",
      done: "Regardless, it's about time you gave your brain a break",
      notDone: "The sesh can happen whenever you're in the mood for it" },
    "Fashion": { ch: "Daily challenge: Put together an outfit that makes you feel good, and wear it. 👗",
      checkin: "Did you put together an outfit that makes you feel good about yourself? What did you choose to wear?",
      done: "Amazing that that outfit exists now and is a confidence booster",
      notDone: "Inspiration hits at different times, you can become a designer whenever the vibe is right" },
    "Writing/journaling": { ch: "Daily challenge: Write a couple sentences — journal entry, short story, haiku, even a random thought that lives rent free in your head. Just get it onto a page. 📝",
      checkin: "Did anything you wrote surprise you, or was it what you expected to write?",
      done: "Whatever ended up on the page, whether it was like Shakespeare or — not, it's out of your head and on to a page.",
      notDone: "Can't just force creativity, when it happens, I know it's going to be great" },
    "Photography": { ch: "Daily Challenge: Take a few pictures of anything that catches your eye, let's see if you find something beautiful! 📸",
      checkin: "What caught your eye that you captured on camera?",
      done: "There's something amazing about capturing a moment, and I'm glad you caught a great one",
      notDone: "No worries, look around and try snapping a few photos — even small moments can be worth capturing on camera" },
    "Podcasts": { ch: "Daily Challenge: put on an episode of your favorite podcast that's really calling your name and let it play while life happens around you 🎧",
      checkin: "What podcast did you listen to? Was there a moment that really stuck with you?",
      done: "Way to go! Taking time for something that interests you is a simple way to take care of yourself.",
      notDone: "No worries, maybe next time you're commuting, running an errand, or doing house chores, you can listen to a podcast." },
    "Playing Musical Instruments": { ch: "Daily challenge: pick up your instrument of choice and jam a little bit, see if you can put together a sick melody 🎶🎹",
      checkin: "How was the jam sesh?",
      done: "Doesn't matter if it was like Bach or noise — sometimes your hands just need something fun to do",
      notDone: "All good, even the Beatles took breaks. Pick up an instrument when inspiration strikes." },
    "Plants": { ch: "Daily Challenge: check in on your plant today — let's make sure it's still thriving, water it, open a window, re-pot it, whatever it needs 🌻",
      checkin: "How is your plant doing? Hopefully pretty well!",
      done: "A little bit of care goes a long way, for plants and for people too",
      notDone: "Plants are forgiving creatures, fortunately, give them some care today" },
    "Makeup/Beauty": { ch: "Daily challenge: Do your makeup or skin care routine today in a way that makes you feel confident, not for any reason — just for you 💄",
      checkin: "Did you stick with your usual makeup or skin care routine or try something different? How did taking that time for yourself make you feel?",
      done: "Whether you kept it simple or tried something new, taking time for yourself is always time well spent.",
      notDone: "Taking time for self-care doesn't expire. It'll be there when you're feeling up for it." },
    "Fitness": { ch: "Daily challenge: Move your body in a way that makes you feel great — workout, yoga, even a walk, anything counts 🤸‍♂️",
      checkin: "How'd your body feel after moving? Energized, relaxed, stronger, sore?",
      done: "Nice job making time to move! Every bit of movement can help ease stress and boost your well-being.",
      notDone: "That's okay! Some days your body needs rest. When the time feels right, even a short walk or a few stretches can be a great way to get moving." }
  };

  /* ============ Interventions — fixed schedule ============ */

  // --- Savoring (4 pairs) ---
  const savoring = [
    { week: 1, n: 1,
      def: [
        "Question of the Day:",
        "Look around — spot 3 things that make you feel good right now. Big or small counts!",
        { pause: 10 },
        { ask: "Tell me more about each item." },
        { ask: "What about each thing makes you feel positive feelings?" },
        "✨ Thanks for taking a moment to tell me about some of the things that bring you joy."
      ],
      swap: [
        "Question of the Day:",
        "Imagine a quiet moment you might have some time in the next few days. It could be enjoying your morning coffee, sitting outside, listening to music, or reading a book.",
        { pause: 10 },
        "Picture yourself fully enjoying that moment.",
        { ask: "What do you imagine you'll notice or appreciate most?" },
        { ask: "How does imagining that peaceful moment make you feel?" },
        "✨ Looking forward to small peaceful moments can help you remember to take some time for yourself and appreciate those moments more when they arrive."
      ] },
    { week: 1, n: 2,
      def: [
        "Question of the Day:",
        "Picture three good things that could realistically happen tomorrow. They can be small, like enjoying your favorite food or hanging out with friends, or bigger, like feeling proud of yourself for finishing something important.",
        { pause: 10 },
        { ask: "What are you looking forward to?" },
        { ask: "How does that make you feel?" },
        "✨ Way to focus on those positive future moments."
      ],
      swap: [
        "Question of the Day:",
        "Look around and notice as many pleasant things as you can, it can be anything — flowers, weather, sounds, colors, scents, or little moments.",
        { pause: 10 },
        { ask: "Name some of the positive things you're noticing." },
        { ask: "What about these things feel comforting?" },
        "✨ Taking time to focus on what's around us can help us stay grounded and live in the moment."
      ] },
    { week: 2, n: 1,
      def: [
        "Question of the Day:",
        { ask: "What's one thing that you're excited about right now?" },
        "Notice what emotions come up.",
        { pause: 10 },
        { ask: "What positive emotions show up for you?" },
        "✨ Pausing to imagine and feel those good vibes is a great way to savor the moment."
      ],
      swap: [
        "Question of the Day:",
        { ask: "What's one thing you'd like to accomplish tomorrow — big or small?" },
        { ask: "How do you think you'll feel once you've done it?" },
        "✨ Taking a moment to set a goal can help you move through the day with intention and enjoy the sense of accomplishment when you finish it. You've already taken the first step to get there."
      ] },
    { week: 3, n: 1,
      def: [
        "Question of the Day:",
        { ask: "What's one small adventure you could have tomorrow? It could be trying something new, enjoying a favorite snack, taking a walk, or having a meaningful conversation." },
        { ask: "Now imagine that moment. What do you think it would be like? What do you see, hear, or feel? Tell me about the details." },
        "✨ Even small adventures to look forward to can lead to big positive feelings. Nice job taking a moment to visualize it."
      ],
      swap: [
        "Question of the Day:",
        { ask: "Think of one thing you did today that you're glad you did. It can be something big or something small." },
        "Take a moment to recognize the effort and care that went into it.",
        { pause: 10 },
        { ask: "What are you proud of about that moment?" },
        "✨ Taking a moment to acknowledge your own efforts can help you savor your accomplishments and build positive feelings."
      ] }
  ];

  // --- Gratitude (5 pairs) ---
  const gratitude = [
    { week: 1, n: 1,
      def: [
        "Question of the Day:",
        { ask: "Reflecting on your past week, what moments, people, or things made you feel better, seen, or happy?" },
        { ask: "Any other things that you're grateful for this week that you'd like to share?" },
        "✨ Love that you're pausing to notice the good from your week. Focusing on moments, people, or things you're thankful for can help you feel uplifted and more grounded."
      ],
      swap: [
        "Question of the Day:",
        "Recall a memorable time when you felt strong about how you handled something.",
        { pause: 10 },
        { ask: "What strengths or qualities do you think helped you in that moment?" },
        { ask: "How do those strengths or qualities show up in your life now?" },
        "✨ Taking time to recognize your personal strengths can help you build confidence and remember what you're capable of."
      ] },
    { week: 2, n: 1,
      def: [
        "Question of the Day:",
        "Focus on someone important in your life.",
        { pause: 10 },
        { ask: "Who is that person and how have they supported you?" },
        { ask: "What's one small way you could show them you appreciate them?" },
        "✨ Great work pausing to notice someone who matters to you. Even small gestures of care and appreciation can have a big impact."
      ],
      swap: [
        "Question of the Day:",
        { ask: "What are three small things that made you feel grateful today?" },
        { ask: "What other positive feelings come up for you?" },
        "✨ Research shows that noticing three good things in our day can help improve well-being over time."
      ] },
    { week: 3, n: 1,
      def: [
        "Question of the Day:",
        { ask: "Tell me about a memorable time when you felt confident about how you handled something." },
        { ask: "What strengths or qualities do you think helped you in that moment?" },
        { ask: "How do those strengths or qualities show up in your life now?" },
        "✨ Taking a moment to recognize your own strengths and how those qualities show up today can help you appreciate how you've grown along the way."
      ],
      swap: [
        "Question of the Day:",
        { ask: "Name some moments that went well for you today." },
        { ask: "Why did they go well?" },
        { ask: "What did you do that helped make them happen?" },
        "✨ Moments like these can be easy to overlook. Reflecting on them, and what helped make them possible, can feel empowering."
      ] },
    { week: 4, n: 1,
      def: [
        "Question of the Day:",
        { ask: "What is something you once wished for, in the past or when you were younger, that is now part of your life?" },
        { ask: "Why is it important to you?" },
        { ask: "What is one thing you learned about yourself?" },
        "✨ Thank you for taking a moment to reflect on how far you've come. That's something worth celebrating!"
      ],
      swap: [
        "Question of the Day:",
        { ask: "Tell me about a memorable time when you felt capable about how you handled something." },
        { ask: "What strengths or qualities do you think helped you in that moment?" },
        { ask: "How do those strengths or qualities show up in your life now?" },
        "✨ Great job reflecting on a moment when you trusted yourself. The qualities that helped you through those experiences are still part of who you are and can continue to support you moving forward."
      ] },
    { week: 4, n: 2,
      def: [
        "Question of the Day:",
        { ask: "Name someone who has made a positive difference in your life." },
        { ask: "What do you appreciate about them?" },
        { ask: "How do they make you feel?" },
        "✨ Recognizing the people who support you is a powerful reminder that you're not journeying alone"
      ],
      swap: [
        "Question of the Day:",
        { ask: "Looking back over your day, what's one good thing that happened (big or small)?" },
        { ask: "What did you do that helped make this good thing happen?" },
        "✨ Nice work taking the time to notice the good in your day. Remember your role in making those good things happen."
      ] }
  ];

  // --- Meaning-Making (3A). {V1},{V2},{V3} are replaced with the
  //     participant's chosen values. ---
  const meaning = [
    { week: 1, n: 1,
      def: [
        "Question of the Day:",
        { ask: "If your life was a playlist with a bunch of songs, what are the \"song(s)\" of this month? " },
        { ask: "Why do these songs resonate with you right now?" },
        "✨ Love it! Such a cool way to capture the energy and ongoing moments in your life."
      ],
      swap: [
        "Question of the Day:",
        { ask: "Can you name something you've done recently that you feel proud of, even if no one else knows about it?" },
        { ask: "Name one or two ways you can celebrate this small win for yourself!" },
        "✨ Celebrating even the little things is a reminder of your growth and resilience."
      ] },
    { week: 2, n: 1,
      def: [
        "Question of the Day:",
        "💭 Let's talk about resilience for a moment. Resilience is the ability to get through or bounce back from hard times and situations.",
        { ask: "Think back to something tough you overcame — maybe physically or emotionally. What helped you keep going during that time?" },
        "🌱 You made it through.",
        { ask: "What did that experience teach you about your strengths or yourself?" },
        "✨ Take a moment to recognize the strength it took to keep moving forward — even small moments count."
      ],
      swap: [
        "Question of the Day:",
        { ask: "If your life was a book with many chapters, what would you name the \"chapter\" of this month?" },
        { ask: "Tell me one more highlight that fits with your chapter title." },
        "✨ Sounds like a good read! Your episode title really fits the energy you're describing. It sounds like a powerful chapter in your series."
      ] },
    { week: 2, n: 2,
      def: [
        "Question of the Day:",
        { ask: "What does the word \"kindness\" mean to you?" },
        { ask: "Can you remember a memorable time someone was there for you, or a time you helped someone else?" },
        { ask: "What made that moment memorable for you?" },
        "✨ Thinking back on acts of kindness is a gentle reminder of the people who bring a light into your life."
      ],
      swap: [
        "Question of the Day:",
        "Let's think about an obstacle that's helped you grow — could be physical, emotional, or just a rough patch in life.",
        { pause: 10 },
        { ask: "What did you tell yourself to keep going?" },
        { ask: "Who supported you along the way?" },
        { ask: "Looking back, in what ways did the experience help you grow or change?" },
        "✨ Reflecting on an obstacle you've faced is a reminder of how much you've overcome."
      ] },
    { week: 3, n: 1,
      def: [
        "Question of the Day:",
        "🌱 Everyone has strengths that help them get through challenging moments.",
        { ask: "Can you think of a time when you surprised yourself with how you handled something?" },
        { ask: "What did that moment teach you about yourself?" },
        "✨ Reflecting on these moments can help you recognize the strengths you already carry with you."
      ],
      swap: [
        "Question of the Day:",
        { ask: "What's a small win or accomplishment that you're proud of today?" },
        { ask: "How does taking a moment to acknowledge that accomplishment make you feel?" },
        "✨ That's wonderful! Big wins are made up of small wins like this."
      ] },
    { week: 3, n: 2,
      def: [
        "Question of the Day:",
        { ask: "You mentioned that {V1} and {V2} were important to you. Can you share more about what these values mean to you?" },
        { ask: "What's a recent moment where you really put {V1} into action?" },
        { ask: "What about {V2}?" },
        "✨ Noticing the values that shape your life can help you stay grounded and connected to what matters most."
      ],
      swap: [
        "Question of the Day:",
        { ask: "Think about a time when you were struggling with something. What did you do to help yourself through it?" },
        { ask: "What did that experience teach you about your own strengths?" },
        { ask: "How have these strengths helped you in your everyday life?" },
        "✨ Noticing the ways you supported yourself during difficult times reflects your resourcefulness, resilience, and ability to care for your own well-being."
      ] },
    { week: 4, n: 1,
      def: [
        "Question of the Day:",
        "🌱 Sometimes we notice our strengths when we look back on moments that stretched us.",
        { ask: "Can you think of a memorable time when you realized you were stronger or more capable than you thought?" },
        { ask: "What did you discover about yourself?" },
        "✨ Love that you're noticing this. Taking notice of the strengths or lessons from hard moments is a reflection of growth."
      ],
      swap: [
        "Question of the Day:",
        { ask: "Think about a recent conversation that felt meaningful or memorable to you. What made it stand out?" },
        { ask: "What else about that conversation felt important or meaningful?" },
        { ask: "How did that conversation make you feel?" },
        "✨ Taking time to reflect on meaningful conversations can remind us of the people and moments that help us feel understood, supported, and connected."
      ] },
    { week: 4, n: 2,
      def: [
        "Question of the Day:",
        { ask: "Take a moment to imagine the life you'd like to be living 5 years from now. What do you see?" },
        { ask: "Can you share a little more about what that life looks like? How would you like to spend your free time?" },
        { ask: "What would your relationships with your friends and loved ones look like?" },
        "✨ Visualizing hopes for the future can be a powerful way to bring clarity and motivation for the journey ahead."
      ],
      swap: [
        "Question of the Day:",
        { ask: "You mentioned that {V3} was important to you. Can you share more about what this value means to you?" },
        { ask: "How do you practice this value in your day-to-day life?" },
        "✨ Small moments that reflect your values can help you feel more connected to the kind of person you want to be."
      ] },
    { week: 4, n: 3, final: true,
      def: [
        "Question of the Day:",
        "Take a moment to congratulate yourself for completing this month-long wellness challenge!",
        { pause: 10 },
        { ask: "What's something that you've learned from this experience?" },
        { ask: "Highlights reel time — What were some of your favorite questions of the day or daily challenges?" },
        { ask: "How can you fit some of these daily positive psychology practices of mindfulness, reflections, and activities into your life moving forward?" },
        "✨ Thank you for embarking on this month-long journey with us!"
      ],
      swap: null }
  ];

  // --- Meaning-Making 3B: cancer-specific. Replaces [Week N, Meaning 1]
  //     default when the participant said YES to cancer questions. ---
  const cancer = [
    { week: 1, steps: [
      "Question of the Day:",
      { ask: "We all play different roles in life, like being a friend, sibling, student, teammate, or family member. Which of these roles feels most meaningful to you right now?" },
      { ask: "What makes that role meaningful to you?" },
      { ask: "How, if at all, has your cancer experience changed the way you see yourself in that role?" },
      { ask: "Can you think of a way you've grown or shown strength in that role because of what you've been through?" },
      { ask: "What kind of impact do you hope to have on the people around you?" },
      "✨ Reflecting the roles you take on reveals your personal strengths and how you show up for those around you."
    ]},
    { week: 2, steps: [
      "Question of the Day:",
      "Take a moment to reflect on what makes you who you are: your strengths, who and what matters most to you, and the things you care about.",
      { ask: "How has your cancer experience changed the way you see your own strengths?" },
      { ask: "How has your cancer experience changed who or what's most important to you or how you think about your priorities?" },
      { ask: "Has your cancer experience changed what you care about? If so, in what ways?" },
      "✨ It takes courage to reflect on how your experiences have shaped you. Giving yourself this time can help you better understand the person you're becoming."
    ]},
    { week: 3, steps: [
      "Question of the Day:",
      "🌱 Let's look back on challenging moments that tested your limits like your cancer journey.",
      { ask: "What positive qualities did you discover about yourself?" },
      { ask: "Who supported you along the way?" },
      { ask: "Now tell me 3 things other people like about you." },
      { ask: "Now tell me 3 things you like about yourself." },
      "✨ Thank you for sharing this reflection. Taking notice of your strengths from difficult moments reflects growth and compassion."
    ]},
    { week: 4, steps: [
      "Question of the Day:",
      { ask: "Think about a time during your cancer experience when things felt especially difficult. What helped you get through it?" },
      { ask: "What did that experience teach you about your own strengths?" },
      { ask: "How have those strengths helped you as you've continued to navigate life challenges now?" },
      "✨ Noticing the ways you supported yourself during difficult times reflects your resourcefulness, resilience, and ability to care for your own well-being."
    ]}
  ];

  /* --- Mindfulness (7): default = AUDIO, swap = different TEXT exercise --- */
  const mindfulnessPre = "Let's take a short mindfulness break with Clover's helper, {NAME}. Are you ready for a guided exercise that takes about 2 minutes? Just press play whenever you're ready! If you'd rather a text version for today's exercise, let me know and I can send you a different one.";

  const mindfulness = [
    { week: 1, n: 1, title: "Breath as My Home Base", audioKey: "mf-w1-1",
      text: [
        "Let's take a short mindfulness moment together.",
        "Take one slow, comfortable breath in.\nAnd gently breathe out.",
        "Notice how you're feeling right now.\nThere is nothing you need to change.\nJust take a moment to be present.",
        { pause: 10 },
        "Now, think of three things you're grateful for today.\nThey don't have to be big.\nThey could be something as simple as a warm drink, a kind conversation, a favorite song, or a quiet moment.",
        { ask: "Can you tell me about those three things you're grateful for? Just text them to me!" },
        "Now read your list slowly.\nAs you read each one, pause for a moment and notice why it matters to you.\nHow does it make you feel?",
        "Maybe you notice warmth. Calm. Comfort.\nOr simply a small sense of appreciation.\nThere is no right or wrong feeling.",
        "If your mind begins to wander, gently bring your attention back to one thing on your list.\nTake another slow breath.\nAllow yourself to stay with that feeling of gratitude for just a few moments.",
        { pause: 10 },
        "Notice how even a small moment of appreciation can help you reconnect with the present.\nWhen you're ready, take one final breath.\nAnd carry this sense of gratitude with you as you continue your day.",
        "✨ Nice work taking this moment for yourself. Noticing even small things you're thankful for can bring calm and help you feel grounded."
      ]},
    { week: 1, n: 2, title: "Sending Kindness to a Loved One", audioKey: "mf-w1-2",
      text: [
        "Let's take a moment to notice your thoughts.",
        "Begin with one slow, comfortable breath.\nAnd gently breathe out.",
        "Now, notice whatever thoughts are moving through your mind.\nYou don't need to stop them.\nOr follow them.\nSimply notice that they're there.",
        { ask: "If you could describe your thoughts in one or two words, what would you say?\nTake a moment to type your answer. They can be anything!" },
        "Now imagine your thoughts drifting by like clouds in the sky or leaves floating down a stream.",
        "You don't need to hold onto them.\nAnd you don't need to push them away.\nSimply notice each thought as it comes and goes.",
        { pause: 10 },
        "Take one more slow breath.\nRemember, mindfulness isn't about having a quiet mind — it's about noticing your experience, one moment at a time.",
        "✨ Thoughts will come and go, but you can always choose to notice them without letting them carry you away."
      ]},
    { week: 2, n: 1, title: "A Short Body Scan", audioKey: "mf-w2-1",
      text: [
        "Let's take a moment to reconnect with the present.",
        "Wherever you are, settle into a comfortable position.\nTake five slow, comfortable breaths.\nWith each breath, allow yourself to become a little more aware of this moment.",
        "There is nothing you need to change.\nJust notice what is already here.",
        { pause: 10 },
        "Now, bring your attention to your surroundings, one sense at a time.",
        { ask: "First, look around you.\nWhat are 3 things you can see?\nTake a moment to type what you notice." },
        { ask: "Now pause and listen.\nWhat are 3 sounds you can hear right now?\nThey might be loud or quiet, nearby or far away. Take a moment to type what you notice." },
        { ask: "Next, notice your sense of smell.\nWhat are 3 scents you can notice?\nIf you don't notice much, that's okay too. Take a moment to type what you notice." },
        { ask: "Now bring your attention to taste.\nWhat is one thing you can taste right now? Maybe it's the taste of a recent drink, a meal, or simply the natural taste in your mouth. Take a moment to type what you notice." },
        { ask: "Finally, notice your sense of touch.\nWhat is one thing you can feel right now?\nMaybe it's your feet on the floor, your clothes against your skin, the chair supporting you, or the temperature of the air. Take a moment to type what you notice." },
        "Take one final, slow breath.\nNotice how your attention feels after slowing down and connecting with your senses. Whenever your mind feels busy or overwhelmed, you can return to your senses to help reconnect with the present moment.",
        "✨ Great job pausing to check in with yourself. Noticing your senses helps you stay present in the moment."
      ]},
    { week: 2, n: 2, title: "Exploring Thoughts and Feelings", audioKey: "mf-w2-2",
      text: [
        "Let's take a moment to focus on your breath.",
        "Take one slow, comfortable breath in.\nAnd gently breathe out.",
        "There is no need to change your breathing.\nSimply notice it, one breath at a time.",
        "As you breathe in, notice how the air feels as it enters your body.\nAs you breathe out, notice how it feels as it leaves.",
        { pause: 10 },
        "Now bring your attention to your body.\nDo you notice movement in your chest?\nYour belly rising and falling?\nYour shoulders relaxing with each breath?",
        "There is no right or wrong experience.\nSimply notice each breath as it comes and goes.",
        "If your mind begins to wander, gently guide your attention back to your breathing.",
        { pause: 10 },
        "Take one final, slow breath.\nNotice how it feels to reconnect with the present, one breath at a time.",
        "✨ Great job noticing your breath and body sensations. Paying attention to these sensations can help you feel more aware and mindful of the present."
      ]},
    { week: 3, n: 1, title: "Returning to Your Breath in Sound, Body, and Feelings", audioKey: "mf-w3-1",
      text: [
        "Let's take a few moments to help your body relax.",
        "Find a comfortable position, whether you're sitting, standing, or lying down.",
        "Take one slow, deep breath in.\nAnd gently breathe out.",
        { ask: "As you breathe, notice how your body feels right now.\nIs there an area that feels tight, tense, or tired?\nChoose one place that stands out.\nTake a moment to type where you notice it." },
        "Now bring your attention to that area.\nAs you breathe in, simply notice the sensation.\nAs you breathe out, imagine that area becoming just a little softer.",
        "There is no need to force anything to relax.\nSimply allow your body to let go where it can.",
        "Now slowly move your attention through your body.\nNotice your feet.\nYour legs.\nYour hips.\nYour stomach.\nYour chest.\nYour shoulders.\nYour arms and hands.\nYour neck.\nYour face.",
        "As you move through each area, see if you can soften any tension you notice, even if it's only a little.",
        { pause: 10 },
        "Take one final, slow breath.\nNotice how your body feels now compared to when you started.\nWhatever you notice is enough.",
        "Simply thank yourself for taking a few moments to slow down and reconnect with your body.",
        "✨ Slowing down and focusing on your breath can help your body and mind reset. Giving yourself even a small moment to breathe is an act of care."
      ]},
    { week: 3, n: 2, title: "Holding on to Multiple Feelings", audioKey: "mf-w3-2",
      text: [
        "Let's take a moment to reconnect with a peaceful memory.",
        "Take one slow, deep breath in.\nAnd gently breathe out.",
        "Now think of a time when you felt calm while spending time outdoors.\nIt could be at the beach, in a park, on a hiking trail, in your backyard, or anywhere in nature.",
        { pause: 10 },
        { ask: "Take a moment to picture that place.\nWhat do you remember seeing?\nWhat sounds were around you?\nWere there any smells, textures, or feelings that stood out?\nTake a moment to text what you remember." },
        "Now return to that scene in your mind for just a few moments.\nImagine yourself there again.\nNotice the colors.\nThe sounds.\nThe feeling of the air.",
        "As you take another slow breath, allow yourself to experience that moment just as it was, without needing to change or analyze it.",
        { pause: 10 },
        "Take one final breath.\nNotice how it feels to reconnect with a place where you felt calm.",
        "Remember that you can return to this memory whenever you need a moment to pause and reconnect with the present.",
        "✨ Nice work visualizing that scene. Tuning into your senses can help your mind slow down and reset."
      ]},
    { week: 4, n: 1, title: "Kindness During Difficult Moments", audioKey: "mf-w4-1",
      text: [
        "Let's take a moment to reflect on your day.",
        "Take one slow, comfortable breath in.\nAnd gently breathe out.",
        { ask: "Now think about your day so far.\nIf you had to describe it using just one word or one image, what would you choose?\nTake a moment to type your answer." },
        "Now pause and notice what happens as you think about that word or image.\nDo you notice any feelings?\nAny sensations in your body?\nOr perhaps a change in your thoughts?",
        "There is no need to analyze or change your experience.\nSimply notice it with curiosity.",
        { pause: 10 },
        "Take one more slow breath.\nSometimes, simply taking a moment to notice your experience can help you reconnect with the present.",
        "✨ Thanks for checking in with yourself. Paying attention to what stood out today helps you see how small moments affect your mood."
      ]}
  ];

  /* --- MBSC (4): default = AUDIO, swap = TEXT of the SAME exercise --- */
  const mbscPre = "Let's take a short mindfulness break with Clover's helper, {NAME}. Are you ready for a guided exercise that takes about 2 minutes? Just press play whenever you're ready! If you'd rather read it instead of listening, let me know and I can send you a text version instead.";

  const mbsc = [
    { week: 1, audioKey: "mbsc-w1",
      text: [
        "Take a slow, deep breath in.\nAnd gently breathe out.",
        "Allow yourself to settle into this moment, just as you are.\nWhatever you're feeling right now is welcome here.",
        "Now, slowly repeat these words to yourself.\n\n\"I can feel scared and still be strong.\"",
        "Take a gentle breath.\n\n\"I can be tired and still be worthy.\"",
        "Another slow breath.\n\n\"I can miss the past and still build new foundations and memories.\"",
        "Notice how each statement feels.\nYou don't have to believe every word right away.\nSimply allow yourself to be open to the possibility that both things can be true at the same time.",
        "You can experience difficult emotions while also holding onto hope, strength, kindness, and growth.",
        { ask: "Now it's your turn.\nComplete this sentence in a way that feels true for you today.\n\n\"I can feel ____ and still be ____.\"\n\nThere is no right or wrong answer.\nChoose words that feel honest and compassionate.\nTake a moment to type out your sentence." },
        "Now, repeat your sentence back to yourself.\nIf you feel comfortable, say it out loud.\nIf not, repeating it quietly in your mind is just as meaningful.\nRepeat it five times.",
        { pause: 10 },
        "Take one final breath.\nAnd thank yourself for showing up with honesty, courage, and kindness today.",
        "✨ Nice work! Affirmations like these help to honor our emotions while embracing your inner strength."
      ]},
    { week: 2, audioKey: "mbsc-w2",
      text: [
        "Find a comfortable position, sitting or lying down.",
        "Take a slow breath in.\nAnd slowly breathe out.",
        "Notice your breathing, just as it is.\nThere is nothing you need to change.\nSimply allow each breath to come and go naturally.",
        "Now, as you breathe in, imagine you are breathing in kindness.\nPicture it as warmth, comfort, or gentle light.\nAllow that feeling to fill your chest and slowly spread throughout your body.",
        "As you breathe out, imagine sharing that kindness with yourself.\nThere is nothing you need to earn.\nSimply allow yourself to receive it.",
        "Let's breathe together.\n\nBreathing in kindness.\nBreathing out kindness.\n\nAgain.\nBreathing in warmth.\nBreathing out gentleness.\n\nOne more time.\nBreathing in compassion.\nBreathing out care.",
        { pause: 10 },
        "If your mind wanders, that's completely natural.\nSimply notice it, and gently return to your breath.",
        "Now bring your attention to the center of your chest.\nImagine each breath creating a little more space for kindness.",
        "You don't have to feel anything special.\nJust stay open to the possibility of treating yourself with a little more care.",
        "Take one final, slow breath.\n\nAs you breathe in, receive kindness.\nAs you breathe out, offer kindness to yourself.",
        "Quietly repeat:\n\n\"May I be kind to myself.\"\n\"May I accept myself as I am today.\"\n\"May I meet this moment with patience.\"",
        "Take one last breath.\nAnd thank yourself for taking a few moments to care for yourself today.",
        "✨ Compassion grows through practice, and you've taken another step today."
      ]},
    { week: 3, audioKey: "mbsc-w3",
      text: [
        "Find a comfortable position.\nAllow your shoulders to soften.",
        "Take a slow breath in.\nAnd gently breathe out.",
        "Notice the natural rhythm of your breathing.\nFor the next few moments, simply let yourself be here.",
        "Now bring your attention to your heart area.\nImagine breathing in warmth.\nAnd breathing out kindness.",
        "Stay with this gentle rhythm for a few breaths.\n\nBreathing in warmth.\nBreathing out kindness.",
        { pause: 10 },
        "Now silently offer yourself these wishes.\n\nMay I be safe.\nMay I feel calm.\nMay I be supported.\nMay I be kind to myself.",
        "Take a slow breath.\nNow think of someone who makes you feel safe, supported, or cared for.\nPicture them in whatever way feels natural.",
        "Silently offer them these same wishes.\n\nMay you be safe.\nMay you feel calm.\nMay you be supported.\nMay you be kind to yourself.",
        "Notice how it feels to extend kindness toward someone you care about.",
        "Now imagine that kindness growing just a little wider.\nYou might include your family.\nYour friends.\nYour classmates.\nPeople you know well, and people you may never meet.",
        "May we all be safe.\nMay we all find moments of peace.\nMay we all experience kindness.",
        { pause: 10 },
        "Take one final breath.\nAs you breathe in, receive kindness.\nAs you breathe out, share kindness.",
        "When you're ready, gently bring your attention back to your surroundings.\nAnd remember that kindness begins with the way you treat yourself.",
        "✨ Reminder that you are just as deserving of the care, patience, and understanding that you give to others."
      ]},
    { week: 4, audioKey: "mbsc-w4",
      text: [
        "Take a slow, deep breath in.\nAnd gently breathe out.",
        "Allow yourself to arrive in this moment with curiosity, no judgment.",
        "Think about something you've been hard on yourself about recently.",
        { pause: 10 },
        { ask: "Now, notice what your inner critic has been saying.\nWhat words or thoughts have been repeating in your mind? Type out your answer." },
        "There is no need to change them.",
        { ask: "Now imagine that someone you care deeply about came to you and said those exact same words about themselves.\nHow would you respond?\nWhat would you want them to hear?\nThink about your response as if you were speaking to them with kindness, patience, and understanding. Type out your response!" },
        "Now pause for a moment.\nNotice the difference between the voice of your inner critic and the voice of compassion.\nIs one gentler?\nMore encouraging?\nMore understanding?",
        { ask: "Now, using that same compassionate voice, write one kind statement to yourself.\nImagine you are speaking to yourself the same way you would speak to someone you truly care about. Type out your statement." },
        "Take one final breath.\nRead your compassionate statement one more time.\nNotice how it feels to offer yourself the same kindness you would so naturally offer someone else.",
        "✨ Nice work noticing your inner critic. Shifting to a \"friend voice\" helps you treat yourself gently and notice what your inner critic says."
      ]}
  ];

  const fallbackReflections = [
    "Thank you for sharing that with me. 💛",
    "That really comes through in what you wrote — thanks for opening up.",
    "I hear you. Thanks for taking a moment with that.",
    "That sounds meaningful. I'm glad you shared it.",
    "Love that you took the time to put that into words. ✨",
    "Thanks for being open about that — it matters.",
    "That's a really thoughtful reflection. 🌱"
  ];

  return {
    greetings, moodMetaphors, moodWordsPos, moodWordsNeg, moodWordsNeu,
    moodFollowPos, moodFollowNeg, ackPos, ackNeu, ackNeg,
    funFacts, funFactTapbacks, audioTapbacks, swapReminders,
    riskKeywords, riskResponse,
    onboardingIntro, interests, values,
    badges, day28BadgeIntro, day28Badge, affirmations,
    baGeneric, baTailored,
    savoring, gratitude, meaning, cancer,
    mindfulnessPre, mindfulness, mbscPre, mbsc,
    fallbackReflections
  };
})();
