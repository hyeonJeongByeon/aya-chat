/* AYA-CHAT (Aim 2) — Clover content bank
   Source: "AYA-CHAT - NEW (Aim 2) Master Intervention Content.docx" (7.13)
           "Chatbot Example Visuals (2).docx"
   Prompt step format:
     "text"            -> Clover sends a bubble
     {ask:"text"}      -> Clover sends bubble, waits for participant reply,
                          then Gemini sends an active-listening reflection
     {askNR:"text"}    -> waits for reply, NO reflection (next scripted line responds)
     {pause:sec}       -> quiet pause (stands in for [10 second pause])
   The last "✨..." string in each prompt is the scripted closing line.
*/
window.CLOVER_CONTENT = (function () {

  /* ---------------- Greetings ---------------- */
  const greetings = [
    "Just checking in ~ how are you feeling today? 🌼",
    "Hey, how's it going? 👋",
    "Hello again 🌤️ How are you?",
    "Hi there 🌱 How's today treating you? 🌤️",
    "Hello, thanks for checking in 🌱 What's your day been like so far? ✨",
    "Welcome back 🌼",
    "Hi, popping in to say hello 👋",
    "Happy to see you!",
    "Hi! Glad you're here 😊",
    "Heyyy, welcome back ✨",
    "Heyyy, good to see you again 👋",
    "Glad you're here 💛"
  ];

  /* ---------------- Mood monitoring metaphors ---------------- */
  const moodMetaphors = [
    { id: "weather", prompt: "How are you feeling today?\n\n☀️ Sunny – Positive mood\n🌤️ Partly Sunny – Kind of positive mood\n☁️ Cloudy – Neutral\n🌧️ Rainy – Kind of negative mood\n⛈️ Stormy – Negative mood",
      pos: ["sunny", "partly"], neg: ["rain", "storm"], neu: ["cloud"] },
    { id: "traffic", prompt: "How are you feeling today?\n\n🛣️✨ Open Highway – Positive mood\n🚘 Smooth Ride – Kind of positive mood\n🛣️ Steady Drive – Neutral\n🚦 Slow Traffic – Kind of negative mood\n🚗🚗🚗 Traffic Jam – Negative mood",
      pos: ["highway", "smooth", "open"], neg: ["slow", "jam"], neu: ["steady"] },
    { id: "battery", prompt: "How are you feeling today?\n\n⚡ Fully Charged – Positive mood\n🔋◼️ Almost Charged – Kind of positive mood\n🔋◻️ Half Charged – Neutral\n🔋 Low Battery – Kind of negative mood\n🪫 Completely Drained – Negative mood",
      pos: ["fully", "almost", "charged"], neg: ["low", "drain"], neu: ["half"] },
    { id: "cup", prompt: "How are you feeling today?\n\n☕✨ Overflowing – Positive mood\n☕ Full – Kind of positive mood\n☕ Half Full – Neutral\n☕ Half Empty – Kind of negative mood\n☕ Empty – Negative mood",
      pos: ["overflow", "full"], neg: ["empty"], neu: ["half full", "half"] },
    { id: "game", prompt: "🎮 Game Mode — How are you feeling today?\n\n🟢 Winning / in the zone – Positive mood\n🟡 Doing good – Kind of positive mood\n⚪ Just playing – Neutral\n🟠 Struggling – Kind of negative mood\n🔴 Game over energy – Negative mood",
      pos: ["winning", "zone", "doing good"], neg: ["struggl", "game over"], neu: ["just playing"] },
    { id: "music", prompt: "How are you feeling today?\n\n🎶 This my jam! – Positive mood\n🎧 Vibing – Kind of positive mood\n🔊 I'll let it play – Neutral\n🔉 Meh – Kind of negative mood\n🔇 Skipppp – Negative mood",
      pos: ["jam", "vibing", "vibe"], neg: ["meh", "skip"], neu: ["let it play", "play"] },
    { id: "ocean", prompt: "How are you feeling today?\n\n🌊 Calm waves – Positive mood\n🌅 Gentle waves – Kind of positive mood\n🪨 Still water – Neutral\n🌧️ Choppy water – Kind of negative mood\n🌪️ Rough storm – Negative mood",
      pos: ["calm", "gentle"], neg: ["choppy", "rough", "storm"], neu: ["still"] }
  ];

  const moodWordsPositive = ["good", "great", "happy", "excited", "hopeful", "better", "well", "awesome", "amazing", "positive", "nice", "fantastic", "1", "2"];
  const moodWordsNegative = ["bad", "sad", "tired", "hard", "awful", "anxious", "stressed", "down", "rough", "negative", "not good", "terrible", "exhausted", "4", "5"];
  const moodWordsNeutral = ["ok", "okay", "fine", "neutral", "normal", "middle", "meh", "alright", "so-so", "3"];

  const moodAcks = {
    positive: [
      "That's so good to hear. You deserve days that feel this way. 💛",
      "Good days are worth celebrating, even the small ones. 🌟",
      "Whatever you did to get here, it's working. YAY! 💛",
      "Yes! A good day deserves to be noticed. Give yourself a pat on the back! 🌟",
      "Feeling good looks good on you 🪞🌟",
      "You're allowed to feel strong and hopeful 💪",
      "Notice what feels good right now — you helped create that ✨"
    ],
    neutral: [
      "Some days are just middle-of-the-road and that's completely normal. You're doing fine.",
      "Coasting days are rest days in disguise. Give yourself some grace today. 🌿",
      "Hey, okay is okay. Not every day has to be amazing — and that's totally fine. 💛",
      "Steady is still progress.",
      "Sometimes stability is the quiet win.",
      "Today feels steady — and steady days are part of a good rhythm.",
      "There's value in a day that feels ordinary."
    ],
    negative: [
      "I'm really glad you checked in, especially on a hard day.",
      "Hard feelings don't mean you're failing. 💙",
      "You're allowed to have tough days without judging yourself for them. 🌿",
      "Thank you for being honest about how you're feeling. That takes courage. 💙",
      "Low days don't last forever, even when it feels like they will. You've gotten through hard days before. 💛",
      "Whatever you're carrying right now, you don't have to carry it perfectly. Just take it one moment at a time. 🌿",
      "You matter on your hard days just as much as your good ones. 💙"
    ]
  };

  const moodFollowUps = {
    positive: [
      "Is there anything in particular that made your day good? 😊",
      "What made today great? 🤗"
    ],
    negative: [
      "What do you think would make today a little bit better?",
      "Is there anything that would turn today around?",
      "What's one small win that we can secure today?"
    ]
  };

  /* ---------------- Fun facts ---------------- */
  const funFactsStatement = [
    "Your brain creates enough electricity to power a lightbulb 💡. So... yeah, you're pretty electric.",
    "Fun fact: Ants can carry 50x their body weight. Some days, just getting through is your ant moment. Tiny but mighty. 🐜",
    "Laughter activates the same parts of your brain as social connection. Even intentional laughter counts.",
    "Sunlight triggers serotonin (the happy hormone), but so does remembering sunlight. Wild, right?",
    "Wombat poop is cube-shaped, which helps it from rolling away when they mark their territory.",
    "Fun fact: An African elephant can lift its own body weight — that's over 6,000 kg.",
    "A group of pandas is called an \"embarrassment.\"",
    "A group of pugs is called a \"grumble.\" It's a fitting name for those grumpy-looking, yet lovable, faces.",
    "The Mona Lisa has no eyebrows. Nobody knows why. It's been almost 500 years and it's still just... unexplained. 🤨",
    "Emperor penguins huddle in a rotating circle in Antarctic storms, so every penguin gets a turn in the warm center. Nobody's stuck on the outside the whole time 🐧",
    "You are, on a cosmic level, made of literal stardust — the calcium in your bones came from a star that exploded billions of years ago ✨🦴",
    "A snail can sleep for 3 years straight if conditions aren't great and then wake up when things improve. Rest is a survival requirement 🐌💤",
    "Crows can recognize individual human faces and hold onto that memory for years. Somewhere out there a crow thinks about you... let that sink in... 🐦‍⬛💭",
    "Weeds can grow through literal concrete. Nobody planted them; nobody's watering them; they still find a way. Rude, but also kind of iconic 🌱",
    "A flea can jump over 200 times its own body length — the human equivalent would be jumping the length of a football field 🐜",
    "Napoleon was the average height for his era — British cartoonists were just trolling him. Historically one of the most legendary trolls 😭",
    "Dolphins have names for each other — specific signature whistles they use to call one another, and they remember them for decades 🐬💬",
    "A day on Venus is longer than a year on Venus — that's what people mean when they say \"I'll do it by tomorrow\" 🧑‍🚀",
    "Laughing works out your abs a little — 15 minutes of hard laughter is comparable to a light cardio workout. Something to consider. 😹💪",
    "Saturn could technically float on water. Now we just need a big enough bathtub 🪐🛁",
    "It rains diamonds on Jupiter and Saturn, according to atmospheric models. Makes you wonder if it does rain \"cats and dogs\" somewhere 💎🐶🙀",
    "Koalas have fingerprints almost identical to humans, close enough to occasionally confuse a crime scene. 🐨🚨",
    "Certain species of frogs can survive being frozen solid through winter — heart stopped completely — then thaw out in spring and hop away like nothing happened 🐸🧊",
    "Some turtles can breathe through their butts when hibernating underwater. Lucky them. 🤓"
  ];

  const funFactTapbacks = [
    "Give a thumbs up, if you learned something new",
    "React with a heart, if this fun fact made you smile",
    "Thumbs up this message, if you were surprised by this fact",
    "React with an emoji that sums up this fun fact",
    "Give a heart, if you enjoyed this fun fact",
    "Give a thumbs up, if you want more fun facts like this",
    "React with a heart, if you would share this fun fact with a friend",
    "React with a heart, if this fun fact made your day a little brighter",
    "React with an exclamation mark, if you were today's years old when you learned this",
    "Give a thumbs up, if you already knew this fact!",
    "React with a 🤣, if this fun fact made you laugh"
  ];

  const funFactsTrivia = [
    { q: "🤔 Quick question before we start... How do otters sleep without drifting away from each other?\n\nA) They tie their tails together\nB) They hold hands\nC) They sleep on land\nD) They don't sleep, ever",
      a: "B! Otters hold hands while sleeping so they don't float apart. Isn't that pretty cute! 🦦" },
    { q: "🤔 What is a group of flamingos called?\n\nA) A flock\nB) A flutter\nC) A flamboyance\nD) A flamingle",
      a: "C! A flamboyance. They knew what they were lol 🦩" },
    { q: "🤔 True or False: It is physically impossible to hum while holding your nose.",
      a: "TRUE! Go on, try it. We caught you. 😂" },
    { q: "🤔 Which one is actually a berry?\n\nA) Strawberry 🍓\nB) Raspberry\nC) Banana 🍌\nD) None of them",
      a: "C! Bananas are berries. Strawberries are NOT. Mindblowing 🤯" },
    { q: "🤔 What is Scotland's national animal?\n\nA) A stag\nB) A golden eagle\nC) A unicorn\nD) A highland cow",
      a: "C! Scotland said \"we want a unicorn 🦄\" and nobody stopped them lolol" },
    { q: "🤔 How old was the oldest honey ever found — and was it still edible?\n\nA) 100 years, yes\nB) 500 years, no\nC) 3,000 years, yes\nD) 3,000 years, definitely not",
      a: "C! Archaeologists found 3,000-year-old honey in Egyptian tombs and it was still good. Honey literally never expires 🍯" },
    { q: "🤔 True or False: A bolt of lightning is hotter than the surface of the sun. ⚡",
      a: "TRUE! Lightning is about 5x hotter. Crazy!" },
    { q: "🤔 Quick question, which one is older, sharks 🦈 or trees 🌲?",
      a: "SHARKS! Sharks have been around for ~450 million years. Trees showed up ~350 million years ago. Sharks were here first." },
    { q: "🤔 True or False: Oxford University is older than the Aztec Empire. 🏛️",
      a: "TRUE! Oxford started teaching around 1096. The Aztec Empire began around 1428. Oxford University is literally ancient." },
    { q: "🤔 What percentage of your DNA do you share with a banana? 🍌\n\nA) 0%\nB) 10%\nC) 50%\nD) 60%",
      a: "D! Humans share about 60% of their DNA with bananas. We don't talk about this enough." },
    { q: "🤔 Which of these was a real rejected name for the app we now call Instagram?\n\nA) Picster\nB) Scotch\nC) Snapgram\nD) Photobox",
      a: "B! Instagram was almost called Scotch. Imagine saying \"did you see it on Scotch.\" No thank you." },
    { q: "🤔 Which animal has three hearts?\n\nA) Shark\nB) Octopus\nC) Dolphin\nD) Jellyfish",
      a: "B! Octopuses have three hearts — two pump blood to the gills, and one pumps it to the rest of the body." },
    { q: "🤔 Which animal sleeps the most hours per day? 😴\n\nA) Dog\nB) Koala\nC) Lion\nD) Dolphin",
      a: "B! Koalas can sleep up to around 20 hours a day. Their schedule is basically snack, nap, repeat 🐨." },
    { q: "🤔 Which artist is known as the \"Queen of Pop\"? 👑🎤\n\nA) Beyoncé\nB) Madonna\nC) Ariana Grande\nD) Rihanna",
      a: "B! Madonna earned the nickname \"Queen of Pop\" after decades of influencing music, fashion, and performance. A true pop culture icon 👑." },
    { q: "🤔 True or False: Spotify's original name was almost \"Soundify.\" 🎧",
      a: "TRUE! Spotify founders considered other names before settling on the name we know today." },
    { q: "🤔 Which animal is known for having the ability to sleep while one half of its brain rests? 🐬\n\nA) Dolphin\nB) Dog\nC) Elephant\nD) Rabbit",
      a: "A! Dolphins can rest one half of their brain at a time so they can continue surfacing for air." },
    { q: "🤔 What is the most widely spoken language in the world by number of native speakers? 🌎\n\nA) English\nB) Spanish\nC) Mandarin Chinese\nD) French",
      a: "C! Mandarin Chinese has the largest number of native speakers worldwide." }
  ];

  /* ---------------- Swap offers ---------------- */
  const swapOffers = [
    "If you want a different question, that's totally cool! Just let me know, I got another one in mind.",
    "Let me know if you want to swap the question",
    "If this question isn't your vibe today, we can try something else.",
    "We can always try a different question, no pressure.",
    "You can absolutely swap this with another question — I won't take it personally 😆"
  ];

  /* ---------------- Values (onboarding + values-based prompts) ---------------- */
  const values = [
    { name: "Leveling Up", def: "to keep changing and growing" },
    { name: "Hope", def: "to maintain a positive and optimistic outlook" },
    { name: "Loved", def: "to be loved by those close to me" },
    { name: "Purpose", def: "to have meaning and direction in my life" },
    { name: "Safety", def: "to be safe and secure" },
    { name: "Caring", def: "to take care of others" },
    { name: "Genuineness", def: "to act in a manner that is true to who I am" },
    { name: "Self-Acceptance", def: "to accept myself as I am" }
  ];

  /* ---------------- Intervention prompt bank ----------------
     Organized as pairs [promptA, promptB] of similar difficulty within
     the same category. The engine randomizes which one is default vs swap.
  */

  // Savoring: 5 pairs, each 1 Present + 1 Future. All Light.
  const savoringPresent = [
    { id: "sav-p1", steps: [
      { ask: "What's one thing that you're excited about right now?" },
      "Notice what emotions come up.",
      { pause: 6 },
      { ask: "What positive emotions show up for you?" },
      "✨ Pausing to imagine and feel those good vibes is a great way to savor the moment."
    ]},
    { id: "sav-p2", steps: [
      "Look around — spot 3 things that make you feel good right now. Big or small counts!",
      { pause: 6 },
      { ask: "What about each thing makes you feel positive feelings?" },
      "✨ Thanks for taking a moment to tell me about some of the things that bring you joy."
    ]},
    { id: "sav-p3", steps: [
      "Look around and notice as many pleasant things as you can, it can be anything — flowers, weather, sounds, colors, scents, or little moments.",
      { pause: 6 },
      { ask: "Name some of the positive things you're noticing." },
      { ask: "What about these things feel comforting?" },
      "✨ Taking time to focus on what's around us can help us stay grounded and live in the moment."
    ]},
    { id: "sav-p4", steps: [
      { ask: "Think of one thing you did today that you're glad you did. It can be something big or something small." },
      "Take a moment to recognize the effort and care that went into it.",
      { pause: 6 },
      { ask: "What are you proud of about that moment?" },
      "✨ Taking a moment to acknowledge your own efforts can help you savor your accomplishments and build positive feelings."
    ]},
    { id: "sav-p5", steps: [
      "Notice one thing that feels comfortable right now. It could be a cozy chair, a warm drink, soft clothing, a cool breeze, or simply taking a moment to rest.",
      { pause: 6 },
      { ask: "What about this moment feels comforting?" },
      { ask: "Any other warm fuzzy feelings you'd like to share?" },
      "✨ Even ordinary moments of comfort can bring us joy when we slow down enough to notice and appreciate them."
    ]}
  ];

  const savoringFuture = [
    { id: "sav-f1", steps: [
      { ask: "What is something (big or small) you're looking forward to this week?" },
      { ask: "What feelings come up for you?" },
      "✨ Anticipating something you're looking forward to can build positive feelings even before the good thing has happened."
    ]},
    { id: "sav-f2", steps: [
      "Picture three good things that could realistically happen tomorrow. They can be small, like enjoying your favorite food or hanging out with friends, or bigger, like feeling proud of yourself for finishing something important.",
      { pause: 6 },
      { ask: "What are you looking forward to?" },
      { ask: "How does that make you feel?" },
      "✨ Way to focus on those positive future moments."
    ]},
    { id: "sav-f3", steps: [
      { ask: "What's one thing you'd like to accomplish tomorrow — big or small?" },
      { ask: "How will you feel to get it done?" },
      "✨ Taking a moment to set a goal can help you move through the day with intention and enjoy the sense of accomplishment when you finish it. You've already taken the first step to get there."
    ]},
    { id: "sav-f4", steps: [
      "Imagine a quiet moment you'll have sometime in the next few days. It could be enjoying your morning coffee, sitting outside, listening to music, or reading a book.",
      { pause: 6 },
      "Picture yourself fully enjoying that moment.",
      { ask: "What do you imagine you'll notice or appreciate most?" },
      { ask: "How does imagining that peaceful moment make you feel?" },
      "✨ Looking forward to small peaceful moments can help you remember to take some time for yourself and appreciate those moments more when they arrive."
    ]},
    { id: "sav-f5", steps: [
      { ask: "What's one small adventure you could have tomorrow — a new experience, a yummy treat, a walk, or a conversation?" },
      { ask: "Imagine what that moment would feel like. Tell me about the details." },
      "✨ Even small adventures to look forward to can lead to big positive feelings. Nice job taking a moment to visualize it."
    ]}
  ];

  // Gratitude: 5 pairs. All Light.
  const gratitudePairs = [
    [
      { id: "gr-1", steps: [
        { ask: "What are three small things that made you feel grateful today?" },
        { ask: "What other positive feelings come up for you?" },
        "✨ Research shows that noticing three good things in our day can help improve well-being over time."
      ]},
      { id: "gr-2", steps: [
        { ask: "Name some moments that went well for you today." },
        { ask: "Why did they go well?" },
        { ask: "What did you do to help make them happen?" },
        "✨ Moments like these can be easy to overlook. Reflecting on them, and what helped make them possible, can feel empowering."
      ]}
    ],
    [
      { id: "gr-3", steps: [
        { ask: "Name a person you're grateful for — could be your best friend, your grandma, or a stranger that helped you with your groceries." },
        { ask: "What do you appreciate about them?" },
        "✨ It's meaningful to recognize the people who show up for us."
      ]},
      { id: "gr-4", steps: [
        "Focus on someone important in your life.",
        { pause: 6 },
        { ask: "Who is that person and how have they supported you?" },
        { ask: "What's one small way you could show them you appreciate them?" },
        "✨ Great work pausing to notice someone who matters to you. Even small gestures of care and appreciation can have a big impact."
      ]}
    ],
    [
      { id: "gr-5", steps: [
        { ask: "Reflecting on your past week, what moments, people, or things made you feel better, seen, or happy?" },
        { ask: "Any other things that you're grateful for this week that you'd like to share?" },
        "✨ Love that you're pausing to notice the good from your week. Focusing on moments, people, or things you're thankful for can help you feel uplifted and more grounded."
      ]},
      { id: "gr-6", steps: [
        { ask: "Looking back over your day, what good thing happened (big or small)?" },
        { ask: "What did you do to help make this good thing happen?" },
        "✨ Nice work taking the time to notice the good in your day. Remember your role in making those good things happen."
      ]}
    ],
    [
      { id: "gr-7", steps: [
        "Recall a memorable time when you felt strong about how you handled something.",
        { pause: 6 },
        { ask: "What strengths or qualities do you think helped you in that moment?" },
        { ask: "How do those strengths or qualities show up in your life now?" },
        "✨ Taking time to recognize your personal strengths can help you build confidence and remember what you're capable of."
      ]},
      { id: "gr-8", steps: [
        { ask: "Tell me about a memorable time when you felt capable about how you handled something." },
        { ask: "What strengths or qualities do you think helped you in that moment?" },
        { ask: "How do those strengths or qualities show up in your life now?" },
        "✨ Great job reflecting on a moment when you trusted yourself. The qualities that helped you through that experience are still part of who you are and can continue to support you moving forward."
      ]}
    ],
    [
      { id: "gr-9", steps: [
        { ask: "Name someone you're grateful for who helped you feel brave or supported during a hard moment." },
        { ask: "What did they do to help?" },
        { ask: "How did that make you feel?" },
        "✨ Recognizing the people who support you is a powerful reminder that you're not in this alone."
      ]},
      { id: "gr-10", steps: [
        { ask: "What is something you once wished for, in the past or when you were younger, that is now part of your life?" },
        { ask: "Why is it important to you?" },
        { ask: "What is one thing you learned about yourself?" },
        "✨ Love that you took a moment to reflect on how far you've come. That's something worth celebrating."
      ]}
    ]
  ];

  // Meaning-making (non-cancer): 7 pairs — 2 Light pairs + 5 Deep pairs.
  const meaningLightPairs = [
    [
      { id: "mn-l1", diff: "L", steps: [
        { ask: "If your life was a book with many chapters, what would you name the \"chapter\" of this month?" },
        { ask: "Tell me one more highlight that fits with your chapter title." },
        "✨ Sounds like a good read! Your chapter title really fits the energy you're describing. It sounds like a powerful chapter in your series."
      ]},
      { id: "mn-l2", diff: "L", steps: [
        { ask: "If your life was a TV show with many seasons, what's the title of the episode this month? What vibe or theme is the episode about?" },
        { ask: "What makes it feel that way?" },
        "✨ Love it! I would love to check that out! Such a cool way to reflect your energy and ongoing moments in your life."
      ]}
    ],
    [
      { id: "mn-l3", diff: "L", steps: [
        { ask: "Can you name something you've done recently that you feel proud of, even if no one else knows about it?" },
        "✨ Celebrating even the little things is a reminder of your growth and resilience."
      ]},
      { id: "mn-l4", diff: "L", steps: [
        { ask: "What's a small win or accomplishment that made you proud today?" },
        "✨ That's wonderful! Big wins are made up of small wins like this."
      ]}
    ]
  ];

  const meaningDeepPairs = [
    [
      { id: "mn-d1", diff: "D", steps: [
        "💭 Let's talk about resilience for a moment. Resilience is the ability to get through or bounce back from hard times and situations.",
        { pause: 6 },
        { ask: "Think back to something tough you overcame — maybe physically or emotionally.\nWhat helped you keep going during that time?" },
        "🌱 You made it through.",
        { ask: "What did that experience teach you about your strengths or yourself?" },
        "✨ Take a moment to recognize the strength it took to keep moving forward — even small moments count."
      ]},
      { id: "mn-d2", diff: "D", steps: [
        "Hey! Let's think about an obstacle that's helped you grow — could be physical, emotional, or just a rough patch in life.",
        { pause: 6 },
        { ask: "What did you tell yourself to keep going?" },
        { ask: "Who supported you along the way?" },
        { ask: "Looking back, in what ways did the experience help you grow or change?" },
        "✨ Reflecting on an obstacle you've faced is a reminder of how much you've overcome and your determination and resourcefulness."
      ]}
    ],
    [
      { id: "mn-d3", diff: "D", steps: [
        { ask: "What does the word \"kindness\" mean to you?" },
        { ask: "Can you remember a memorable time someone was there for you, or a time you helped someone else?" },
        { ask: "What made that moment memorable for you?" },
        "✨ Thinking about moments you received or gave kindness is a reminder of how much spreading kindness can uplift yourself and others."
      ]},
      { id: "mn-d4", diff: "D", steps: [
        { ask: "What does \"kindness\" mean or feel like to you?" },
        { ask: "Can you describe a moment when someone showed you kindness, or when you did something nice for someone (even if it was small)?" },
        { ask: "What part of that moment stood out to you the most?" },
        "✨ Thinking back on acts of kindness is a gentle reminder of the people who bring a light into your life."
      ]}
    ],
    [
      { id: "mn-d5", diff: "D", steps: [
        "🌱 Everyone has strengths that help them get through challenging moments.",
        { pause: 6 },
        { ask: "Can you think of a time when you surprised yourself with how you handled something?" },
        { ask: "What did that moment teach you about yourself?" },
        "✨ Reflecting on these moments can help you recognize the strengths you already carry with you."
      ]},
      { id: "mn-d6", diff: "D", steps: [
        "🌱 Sometimes we notice our strengths when we look back on moments that stretched us.",
        { ask: "Can you think of a memorable time when you realized you were stronger or more capable than you thought?" },
        { ask: "What did you discover about yourself?" },
        "✨ Love that you're noticing this. Taking notice of the strengths or lessons from hard moments is a reflection of growth."
      ]}
    ],
    [
      { id: "mn-d7", diff: "D", steps: [
        { ask: "What are some values that feel core to who you are — like kindness, honesty, or growth?" },
        { ask: "Where did you pick up or learn those values?" },
        { ask: "How do you put into practice those values in your everyday life?" },
        "✨ Noticing the values that shape your life can help you stay grounded and connected to what matters most."
      ]},
      { id: "mn-d8", diff: "D", steps: [
        { ask: "What are the things you stand for or try to live by?" },
        { ask: "Who or what shaped those values?" },
        { ask: "How do they show up in your daily choices or habits?" },
        "✨ Reflecting on how your values show up in your life helps strengthen self-awareness and inspires us to act in authentic and purposeful ways."
      ]}
    ],
    [
      { id: "mn-d9", diff: "D", steps: [
        { ask: "Take a moment to imagine the life you'd like to be living a few years from now. What do you see?" },
        { ask: "Tell me a little about your social world, your work/school life, how you spend your free time, with family or people you love." },
        "✨ Visualizing hopes for the future can be a powerful way to bring clarity and motivation for the journey ahead."
      ]},
      { id: "mn-d10", diff: "D", steps: [
        { ask: "Let's fast-forward a few years for a moment. Picture your life going really well. What does it look like?" },
        { ask: "What comes to mind when you think about:\nfriends or community, school or work, hobbies or health, and family?" },
        "✨ Taking time to picture your future is a meaningful way to keep you focused on what brings you joy and fulfillment."
      ]}
    ]
  ];

  // Values-based prompts (use participant's chosen value). Used as an extra deep pair.
  // {V} = value name, {DEF} = definition
  const meaningValuesPair = [
    { id: "mn-v1", diff: "D", usesValue: true, steps: [
      "You named {V} as something that matters to you. Here's one way to think about it: {V} is {DEF}.",
      { ask: "Who or what experiences shaped that for you?" },
      { ask: "How does {V} show up in what you do day-to-day?" },
      "✨ Small moments that reflect your values can help you feel more connected to the kind of person you want to be."
    ]},
    { id: "mn-v2", diff: "D", usesValue: true, steps: [
      "You named {V} as something that matters to you. Here's one way to think about it: {V} is {DEF}.",
      { ask: "When you think about {V}, what's a recent moment where you really put it into action?" },
      "✨ Even small actions can reflect what matters most to you. Taking time to notice that can be really meaningful."
    ]}
  ];

  // Cancer-specific meaning-making: 7 prompts, all Deep.
  // For participants who said YES to cancer questions: these are the DEFAULTS,
  // and the swap is always a non-cancer meaning prompt.
  const cancerPrompts = [
    { id: "ca-1", steps: [
      { askNR: "What values feel most important to you?" },
      "✨ I love hearing that. It's clear those values shape how you approach and experience the world.",
      { ask: "How has your experience with cancer changed the way you see yourself?" },
      "✨ Thank you for sharing that. It sounds like this experience has shaped how you see yourself in some really meaningful ways. I appreciate your openness."
    ]},
    { id: "ca-2", steps: [
      { ask: "Reflect on the parts that make you who you are: strengths, dreams, or what you care about. In what ways has cancer shaped how you see or understand yourself?" },
      "✨ It takes courage to reflect on how your experiences have shaped you. Giving yourself this time can help you better understand the person you're becoming."
    ]},
    { id: "ca-3", steps: [
      "Take a moment to think about who you've become and what's shaped you along the way.",
      { pause: 6 },
      { ask: "In what ways has your experience with cancer influenced the person you are now?" },
      "✨ Thank you for sharing this reflection. Taking time to think about how your experiences have shaped you can bring meaningful insight into the person you've become."
    ]},
    { id: "ca-4", steps: [
      "You've changed and grown in many ways over time.",
      { ask: "What experiences, including your cancer journey, helped shape your strengths, values, or outlook?" },
      "✨ Thank you for taking this brave moment to reflect. Experiences that shape us often reveal the perspective and growth we've gained over time."
    ]},
    { id: "ca-5", steps: [
      { ask: "When you think about your future, what do you hope people will remember about you?\nIt could be your humor, kindness, strength, or how you made others feel." },
      "✨ Taking a moment to reflect on the impact you want to make on others highlights the way your presence makes a positive difference."
    ]},
    { id: "ca-6", steps: [
      { ask: "Imagine the future version of you looking back. How would you like to be remembered? What lasting impact do you hope to have?" },
      "✨ Imagining the kind of impact you want to have is a powerful way of shaping the story you're creating in your life."
    ]},
    { id: "ca-7", steps: [
      { ask: "When things felt hard after your cancer diagnosis and through treatments, what helped you stay strong or keep moving forward?" },
      "✨ It takes courage to look back on challenging times. Taking notice of what supported you along the way is a reminder of the strength it took to get through."
    ]},
    { id: "ca-8", steps: [
      "We all wear a few different hats in life — being a friend, sibling, student, or part of a team.",
      { ask: "Which roles feel most meaningful to you right now?" },
      { ask: "What makes those roles important to you?" },
      { ask: "If applicable, how has cancer affected how you see yourself in those roles?" },
      "✨ Reflecting on the roles you take on reveals the growth and resilience you carry with you."
    ]}
  ];

  // Mindfulness (text versions): 7 pairs, all Light.
  const mindfulnessPairs = [
    [
      { id: "mf-1", steps: [
        "Let's take a short mindfulness moment together.",
        "Take one slow, comfortable breath in.\nAnd gently breathe out.",
        "Notice how you're feeling right now.\nThere is nothing you need to change.\nJust take a moment to be present.",
        { pause: 6 },
        "Now, think of three things you're grateful for today.\nThey don't have to be big.\nThey could be something as simple as a warm drink, a kind conversation, a favorite song, or a quiet moment.",
        { ask: "Take a moment to type your three things." },
        "Now read your list slowly.\nAs you read each one, pause for a moment and notice why it matters to you.\nHow does it make you feel?",
        "Maybe you notice warmth. Calm. Comfort. Or simply a small sense of appreciation.\nThere is no right or wrong feeling.",
        "If your mind begins to wander, gently bring your attention back to one thing on your list.\nTake another slow breath.\nAllow yourself to stay with that feeling of gratitude for just a few moments.",
        { pause: 6 },
        "When you're ready, take one final breath.\nAnd carry this sense of gratitude with you as you continue your day.",
        "✨ Nice work taking this moment for yourself. Noticing even small things you're thankful for can bring calm and help you feel grounded."
      ]},
      { id: "mf-2", steps: [
        "Let's take a moment to slow down.",
        "Take one slow, comfortable breath in.\nAnd gently breathe out.",
        "Notice how you're feeling right now.\nThere is no need to change anything.\nSimply be present with this moment.",
        { pause: 6 },
        "Now, think of three moments from today that brought you joy, comfort, or a sense of peace.\nThey don't have to be big moments.\nMaybe someone smiled at you. Maybe you enjoyed a meal, a favorite song, or a few quiet minutes to yourself.",
        { ask: "Take a moment to type your three moments." },
        "Now, look at the first one on your list.\nTake a few seconds to picture that moment again.\nNotice what you saw. What you heard. How you felt.",
        "Then move to the second moment.\nAllow yourself to experience it again, just for a few seconds.",
        "Finally, bring your attention to the third moment.\nNotice what made it meaningful to you.",
        "If your mind begins to wander, gently guide your attention back to the moment you're remembering.\nThere is nothing you need to analyze.\nSimply notice the experience as it comes to mind.",
        { pause: 6 },
        "Take one more slow breath.\nNotice how it feels to pause and fully appreciate these small moments.",
        "✨ Wonderful job focusing on the small joys of the day. That's a great way to identify and savor the positive moments you might otherwise miss."
      ]}
    ],
    [
      { id: "mf-3", steps: [
        "Let's take a moment to reconnect with the present.",
        "Wherever you are, settle into a comfortable position.\nTake five slow, comfortable breaths.\nWith each breath, allow yourself to become a little more aware of this moment.",
        { pause: 8 },
        "Now, bring your attention to your surroundings, one sense at a time.",
        { ask: "First, look around you. What are 3 things you can see?\nTake a moment to type what you notice." },
        { ask: "Now pause and listen. What are 3 sounds you can hear right now?\nThey might be loud or quiet, nearby or far away." },
        { ask: "Next, notice your sense of smell. What scents can you notice?\nIf you don't notice much, that's okay too." },
        { ask: "Now bring your attention to taste. What is one thing you can taste right now?\nMaybe it's the taste of a recent drink, a meal, or simply the natural taste in your mouth." },
        { ask: "Finally, notice your sense of touch. What is one thing you can feel right now?\nMaybe it's your feet on the floor, your clothes against your skin, the chair supporting you, or the temperature of the air." },
        "Take one final, slow breath.\nNotice how your attention feels after slowing down and connecting with your senses.",
        "Whenever your mind feels busy or overwhelmed, you can return to your senses to help reconnect with the present moment.",
        "✨ Great job pausing to check in with yourself. Noticing your senses helps you stay present in the moment."
      ]},
      { id: "mf-4", steps: [
        "Let's take a brief moment to simply listen.",
        "Find a comfortable position and take one slow, easy breath.",
        { pause: 6 },
        { ask: "Now bring your attention to the sounds around you.\nWhat do you notice? Take a moment to type what you hear." },
        "As you listen, try not to judge the sounds as good or bad.\nSimply notice them.",
        "Some may be loud. Some may be quiet.\nSome may be close by. Others may be farther away.\nYou might even notice moments of silence between sounds.",
        "If your mind begins to wander, that's completely natural.\nGently bring your attention back to listening, one sound at a time.",
        { pause: 6 },
        "Take one more slow breath.\nNotice what it's like to simply listen, without needing to change or figure anything out.",
        "✨ Thanks for taking this pause. Listening to the world around you, without labeling, is a great way to practice presence."
      ]}
    ],
    [
      { id: "mf-5", steps: [
        "Let's take a moment to notice what's around you.",
        "Take one slow, comfortable breath.",
        { ask: "Now, slowly look around your surroundings as if you're seeing them for the first time.\nWhat catches your attention? Take a moment to type what you notice." },
        "As you continue looking, notice the colors around you.\nThe different textures.\nThe shapes and patterns.",
        "You don't need to analyze or judge what you see.\nSimply observe with curiosity.",
        "You might notice something you've walked past many times before.\nOr a small detail you hadn't seen until now.",
        { pause: 6 },
        "Take one more slow breath.\nNotice what it's like to simply observe the present moment with fresh eyes.",
        "✨ Observing your surroundings without judgment helps you to calm your mind and bring your attention back to the present."
      ]},
      { id: "mf-6", steps: [
        "Let's take a moment to slow down.",
        "Take one slow, comfortable breath in.\nAnd gently breathe out.",
        "Now, look at an object near you.\nIt could be a pen, a mug, a plant, or anything within reach.",
        { ask: "Take a moment to really observe it.\nWhat colors do you notice? What shapes, patterns, or textures stand out?\nTake a moment to describe what you see." },
        "Imagine you're seeing this object for the very first time.\nNotice any small details you may have overlooked before.",
        "There is nothing you need to figure out.\nSimply observe with curiosity.",
        { pause: 6 },
        "Take one more slow breath.\nNotice what it feels like to slow down and pay closer attention to the present moment.",
        "✨ Taking a closer look at the present moment helps you discover that there's always something new to notice."
      ]}
    ],
    [
      { id: "mf-7", steps: [
        "Let's take a moment to focus on your breath.",
        "Take one slow, comfortable breath in.\nAnd gently breathe out.",
        "There is no need to change your breathing.\nSimply notice it, one breath at a time.",
        "As you breathe in, notice how the air feels as it enters your body.\nAs you breathe out, notice how it feels as it leaves.",
        { pause: 8 },
        "Now bring your attention to your body.\nDo you notice movement in your chest?\nYour belly rising and falling?\nYour shoulders relaxing with each breath?",
        "There is no right or wrong experience.\nSimply notice each breath as it comes and goes.",
        "If your mind begins to wander, gently guide your attention back to your breathing.",
        { pause: 6 },
        "Take one final, slow breath.\nNotice how it feels to reconnect with the present, one breath at a time.",
        "✨ Great job noticing your breath and body sensations. Paying attention to these sensations can help you feel more aware and mindful of the present."
      ]},
      { id: "mf-8", steps: [
        "Let's take a moment to check in with your body.",
        "Find a comfortable position and take one slow, easy breath.",
        "Now bring your attention to your feet and toes.\nNotice any sensations you can feel.\nMaybe there's warmth. Coolness. Pressure. Tingling.\nOr perhaps very little at all.\nThere is no right or wrong experience.",
        { pause: 8 },
        "Now slowly move your attention upward through your legs, your hips, your stomach, your chest, your shoulders, your arms, your hands, your neck, and finally to the top of your head.\nAs you move through each area, simply notice what is there.",
        { ask: "Take a moment to type one or two sensations you noticed." },
        "If you came across any areas of tension, simply acknowledge them without trying to change them.",
        "Take one more slow breath.\nNotice how it feels to reconnect with your body, just as it is, in this moment.",
        "✨ Focusing on your breath and body sensations is a simple way to feel grounded and centered."
      ]}
    ],
    [
      { id: "mf-9", steps: [
        "Let's take a few moments to help your body relax.",
        "Find a comfortable position, whether you're sitting, standing, or lying down.",
        "Take one slow, deep breath in.\nAnd gently breathe out.",
        { ask: "As you breathe, notice how your body feels right now.\nIs there an area that feels tight, tense, or tired?\nChoose one place that stands out and type where you notice it." },
        "Now bring your attention to that area.\nAs you breathe in, simply notice the sensation.\nAs you breathe out, imagine that area becoming just a little softer.",
        "There is no need to force anything to relax.\nSimply allow your body to let go where it can.",
        "Now slowly move your attention through your body.\nYour feet. Your legs. Your hips. Your stomach. Your chest. Your shoulders. Your arms and hands. Your neck. Your face.",
        "As you move through each area, see if you can soften any tension you notice, even if it's only a little.",
        { pause: 8 },
        "Take one final, slow breath.\nNotice how your body feels now compared to when you started.\nWhatever you notice is enough.",
        "Simply thank yourself for taking a few moments to slow down and reconnect with your body.",
        "✨ Slowing down and focusing on your breath can help your body and mind reset. Giving yourself even a small moment to breathe is an act of care."
      ]},
      { id: "mf-10", steps: [
        "Let's take a moment to reconnect with a peaceful memory.",
        "Take one slow, deep breath in.\nAnd gently breathe out.",
        "Now think of a time when you felt calm while spending time outdoors.\nIt could be at the beach, in a park, on a hiking trail, in your backyard, or anywhere in nature.",
        { pause: 6 },
        { ask: "Take a moment to picture that place.\nWhat do you remember seeing? What sounds were around you?\nWere there any smells, textures, or feelings that stood out?\nTake a moment to describe what you remember." },
        "Now return to that scene in your mind for just a few moments.\nImagine yourself there again.\nNotice the colors. The sounds. The feeling of the air.",
        "As you take another slow breath, allow yourself to experience that moment just as it was, without needing to change or analyze it.",
        { pause: 6 },
        "Take one final breath.\nNotice how it feels to reconnect with a place where you felt calm.",
        "Remember that you can return to this memory whenever you need a moment to pause and reconnect with the present.",
        "✨ Nice work visualizing that scene. Tuning into your senses can help your mind slow down and reset."
      ]}
    ],
    [
      { id: "mf-11", steps: [
        "Let's take a moment to check in with yourself.",
        "Take one slow, deep breath in.\nAnd gently breathe out.",
        "As you breathe, notice how you're feeling right now.\nThere is no need to change anything.\nSimply become aware of what is here.",
        { ask: "If you had to describe your current emotion using just one word, what would it be?\nTake a moment to type your answer." },
        "Now read that word back to yourself.\nNotice how it feels to simply name your emotion.",
        "You don't have to judge it, explain it, or make it go away.\nJust let it be here for this moment.",
        { pause: 6 },
        "Take one more slow breath.\nRemember, emotions come and go, and simply noticing them is an important part of being present.",
        "✨ Naming your feelings helps you pause and tune in!"
      ]},
      { id: "mf-12", steps: [
        "Let's take a moment to reflect on your day.",
        "Take one slow, comfortable breath in.\nAnd gently breathe out.",
        { ask: "Now think about your day so far.\nIf you had to describe it using just one word or one image, what would you choose?\nTake a moment to type your answer." },
        "Now pause and notice what happens as you think about that word or image.\nDo you notice any feelings?\nAny sensations in your body?\nOr perhaps a change in your thoughts?",
        "There is no need to analyze or change your experience.\nSimply notice it with curiosity.",
        { pause: 6 },
        "Take one more slow breath.\nSometimes, simply taking a moment to notice your experience can help you reconnect with the present.",
        "✨ Thanks for checking in with yourself. Paying attention to what stood out today helps you see how small moments affect your mood."
      ]}
    ],
    [
      { id: "mf-13", steps: [
        "Let's pause for a moment.",
        "Take one slow breath in.\nAnd gently breathe out.",
        { ask: "Notice where you feel your breath most clearly.\nMaybe it's in your chest. Your belly. Or the air moving through your nose.\nTake a moment to type where you notice it most." },
        "Stay with that one sensation for your next few breaths.\nIf your attention wanders, gently bring it back to your breathing.",
        "There is no perfect way to do this.\nEach time you notice your attention returning, you're practicing mindfulness.",
        { pause: 8 },
        "Take one final breath.\nNotice how it feels to focus on just one moment at a time.",
        "✨ Every time you return your attention to your breath, you strengthen your ability to stay present."
      ]},
      { id: "mf-14", steps: [
        "Let's take a moment to notice your thoughts.",
        "Begin with one slow, comfortable breath.\nAnd gently breathe out.",
        "Now, notice whatever thoughts are moving through your mind.\nYou don't need to stop them.\nOr follow them.\nSimply notice that they're there.",
        { ask: "If you could describe your thoughts in one or two words, what would you say?\nTake a moment to type your answer. They can be anything!" },
        "Now imagine your thoughts drifting by like clouds in the sky or leaves floating down a stream.",
        "You don't need to hold onto them.\nAnd you don't need to push them away.\nSimply notice each thought as it comes and goes.",
        { pause: 6 },
        "Take one more slow breath.\nRemember, mindfulness isn't about having a quiet mind — it's about noticing your experience, one moment at a time.",
        "✨ Thoughts will come and go, but you can always choose to notice them without letting them carry you away."
      ]}
    ]
  ];

  // MBSC: 4 pairs, all Light. Text-based only.
  const mbscPairs = [
    [
      { id: "mb-1", steps: [
        "Take a slow, deep breath in.\nAnd gently breathe out.",
        "Allow yourself to settle into this moment, just as you are.\nWhatever you're feeling right now is welcome here.",
        "Now, slowly repeat these words to yourself.\n\n\"I can feel scared and still be strong.\"",
        "Take a gentle breath.\n\n\"I can be tired and still be worthy.\"",
        "Another slow breath.\n\n\"I can miss the past and still build new foundations and memories.\"",
        "Notice how each statement feels.\nYou don't have to believe every word right away.\nSimply allow yourself to be open to the possibility that both things can be true at the same time.",
        "You can experience difficult emotions while also holding onto hope, strength, kindness, and growth.",
        { ask: "Now it's your turn.\nComplete this sentence in a way that feels true for you today:\n\n\"I can feel ________ and still be ________.\"\n\nThere is no right or wrong answer. Choose words that feel honest and compassionate." },
        "Now, read your sentence back to yourself.\nIf you feel comfortable, say it out loud.\nIf not, repeating it quietly in your mind is just as meaningful.\nRepeat it five times.",
        { pause: 8 },
        "Take one final breath.\nAnd thank yourself for showing up with honesty, courage, and kindness today.",
        "✨ Nice work! Affirmations like these help to honor our emotions while embracing your inner strength."
      ]},
      { id: "mb-2", steps: [
        "Take a slow, deep breath in.\nAnd gently breathe out.",
        "Allow yourself to settle into this moment.\nAs you breathe, let your breath become steady and natural.",
        "With each inhale and exhale, silently repeat these words to yourself.\n\nAs you breathe in: \"May I be kind to myself.\"\nAs you breathe out: \"Even in moments of stress.\"",
        "Continue this gentle rhythm for five breaths.",
        { pause: 10 },
        "Now, if another phrase feels more meaningful today, you can choose one of these instead:\n\n\"May I feel steady... even when things feel uncertain.\"\n\"May I trust myself... to handle difficult moments.\"\n\"I can do this... one step at a time.\"\n\"I'm doing my best... and that is enough.\"",
        "Choose the words that feel most supportive for you today.\nRepeat your chosen phrase for five slow breaths.",
        { pause: 10 },
        "Take one final breath.\nAnd thank yourself for offering your mind and body a moment of kindness.",
        "✨ Kind words of affirmation help you feel steady and treat yourself with grace and self-compassion."
      ]}
    ],
    [
      { id: "mb-3", steps: [
        "Find a comfortable position.\nAllow your shoulders to relax.",
        "Take a slow breath in.\nAnd gently breathe out.",
        "For a few moments, simply notice your breathing.\nEach breath is an opportunity to begin again.",
        "Now imagine a small light in the center of your chest.\nIt doesn't need to be bright.\nJust enough to notice.",
        "With every inhale, imagine that light becoming a little warmer.\nWith every exhale, imagine it gently spreading through your body.\nTo your shoulders. Your arms. Your hands. Your stomach. Your legs.\nUntil your whole body is surrounded by a quiet sense of warmth.",
        { pause: 8 },
        "Now imagine that this warmth naturally reaches beyond you.\nIt reaches someone you care about.\nThen someone you don't know very well.\nThen anyone who may be having a difficult day today.",
        "You don't need to picture anyone perfectly.\nSimply hold the intention that they experience a little more peace, support, or hope.",
        "Now bring that same warmth back to yourself.\nRemember that you are just as deserving of kindness as anyone else.",
        "Quietly repeat:\n\n\"May I meet myself with understanding.\"\n\"May I make space for both joy and struggle.\"\n\"May I continue growing with kindness.\"",
        { pause: 6 },
        "Take one slow, comfortable breath.\nFeel yourself sitting here. Supported. Present.",
        "When you're ready, gently return your attention to the room, carrying this sense of warmth with you.",
        "✨ Every moment of self-kindness is a step toward building a more compassionate relationship with yourself."
      ]},
      { id: "mb-4", steps: [
        "Find a comfortable position, sitting or lying down.",
        "Take a slow breath in.\nAnd slowly breathe out.",
        "Notice your breathing, just as it is.\nThere is nothing you need to change.\nSimply allow each breath to come and go naturally.",
        "Now, as you breathe in, imagine you are breathing in kindness.\nPicture it as warmth, comfort, or gentle light.\nAllow that feeling to fill your chest and slowly spread throughout your body.",
        "As you breathe out, imagine sharing that kindness with yourself.\nThere is nothing you need to earn.\nSimply allow yourself to receive it.",
        "Let's breathe together.\n\nBreathing in kindness.\nBreathing out kindness.\n\nAgain.\nBreathing in warmth.\nBreathing out gentleness.\n\nOne more time.\nBreathing in compassion.\nBreathing out care.",
        { pause: 10 },
        "If your mind wanders, that's completely natural.\nSimply notice it, and gently return to your breath.",
        "Take one final, slow breath.\n\nQuietly repeat:\n\"May I be kind to myself.\"\n\"May I accept myself as I am today.\"\n\"May I meet this moment with patience.\"",
        "Take one last breath.\nAnd thank yourself for taking a few moments to care for yourself today.",
        "✨ Compassion grows through practice, and you've taken another step today."
      ]}
    ],
    [
      { id: "mb-5", steps: [
        "Take a slow, deep breath in.\nAnd gently breathe out.",
        "Allow yourself to arrive in this moment with curiosity, no judgment.",
        { ask: "Think about something you've been hard on yourself about recently.\nTake a moment to type your answer." },
        { ask: "Now, notice what your inner critic has been saying.\nWhat words or thoughts have been repeating in your mind?\nThere is no need to change them. Simply write them down exactly as they sound." },
        { ask: "Now imagine that someone you care deeply about came to you and said those exact same words about themselves.\nHow would you respond? What would you want them to hear?\nWrite your response as if you were speaking to them with kindness, patience, and understanding." },
        "Now pause for a moment.\nNotice the difference between the voice of your inner critic and the voice of compassion.\nIs one gentler? More encouraging? More understanding?",
        { ask: "Now, using that same compassionate voice, write one kind statement to yourself.\nImagine you are speaking to yourself the same way you would speak to someone you truly care about." },
        "Take one final breath.\nRead your compassionate statement one more time.\nNotice how it feels to offer yourself the same kindness you would so naturally offer someone else.",
        "✨ Nice work noticing your inner critic. Shifting to a \"friend voice\" helps you treat yourself gently and notice what your inner critic says."
      ]},
      { id: "mb-6", steps: [
        "Find a comfortable position.\nTake a slow breath in.\nAnd let it out gently.",
        "For the next few moments, simply notice what is here.\nNotice your thoughts.\nNotice your emotions.\nNotice any sensations in your body.",
        "There is nothing you need to change.\nJust allow yourself to be present with this moment.",
        { pause: 6 },
        "Now, offer yourself a small gesture of kindness.\nYou might soften your shoulders.\nTake a slightly deeper breath.\nOr place a hand somewhere that feels comforting, like your chest, your heart, or your arm.",
        "As you breathe, quietly say to yourself:\n\n\"I've got myself right now.\"\n\"I can take this one moment at a time.\"\n\"It's okay to be exactly where I am.\"",
        "If those words don't feel right today, you can simply stay with:\n\n\"This is difficult.\"\n\"And I'm here with myself.\"",
        "Remember that everyone experiences difficult moments.\nYou are not alone in feeling this way.",
        { pause: 6 },
        "Now return your attention to your breathing.\nOne breath in.\nAnd one breath out.\nLet each breath remind you that you can meet this moment with patience and kindness.",
        "When you're ready, gently return to the day, carrying this sense of compassion with you.",
        "✨ Everyone has moments where things feel hard or messy sometimes. Taking a moment to treat yourself with kindness instead of judgment can really matter."
      ]}
    ],
    [
      [ /* placeholder replaced below */ ]
    ]
  ];
  // 4th MBSC pair: loving-kindness wishes / breathing in comfort
  mbscPairs[3] = [
    { id: "mb-7", steps: [
      "Find a comfortable position.\nAllow your shoulders to soften.",
      "Take a slow breath in.\nAnd gently breathe out.",
      "Notice the natural rhythm of your breathing.\nFor the next few moments, simply let yourself be here.",
      "Now bring your attention to your heart area.\nImagine breathing in warmth.\nAnd breathing out kindness.",
      "Stay with this gentle rhythm for a few breaths.",
      { pause: 8 },
      "Now silently offer yourself these wishes:\n\nMay I be safe.\nMay I feel calm.\nMay I be supported.\nMay I be kind to myself.",
      "Take a slow breath.\nNow think of someone who makes you feel safe, supported, or cared for.\nPicture them in whatever way feels natural.",
      "Silently offer them these same wishes:\n\nMay you be safe.\nMay you feel calm.\nMay you be supported.\nMay you be kind to yourself.",
      "Notice how it feels to extend kindness toward someone you care about.",
      "Now imagine that kindness growing just a little wider.\nYour family. Your friends. Your classmates.\nPeople you know well, and people you may never meet.\n\nMay we all be safe.\nMay we all find moments of peace.\nMay we all experience kindness.",
      { pause: 6 },
      "Take one final breath.\nAs you breathe in, receive kindness.\nAs you breathe out, share kindness.",
      "When you're ready, gently bring your attention back to your surroundings.\nAnd remember that kindness begins with the way you treat yourself.",
      "✨ Reminder that you are just as deserving of the care, patience, and understanding that you give to others."
    ]},
    { id: "mb-8", steps: [
      "Find a position that feels comfortable.\nYou can sit, lie down, or settle in whatever way feels supportive.",
      "Take a slow breath in.\nAnd gently breathe out.\nAllow your breathing to find its own natural rhythm.",
      "For the next few moments, imagine that each breath is bringing you exactly what you need.",
      "As you breathe in, imagine breathing in comfort.\nAs you breathe out, allow your body to soften just a little.\n\nAgain.\nBreathing in comfort.\nBreathing out tension.",
      { pause: 8 },
      "With every breath, imagine your body quietly saying:\n\n\"It's okay to slow down.\"\n\"It's okay to rest.\"\n\"You don't have to carry everything all at once.\"",
      "If your mind begins to wander, simply notice where it went.\nThen gently guide your attention back to your breathing.",
      "Now bring your awareness to your heart, or anywhere in your body that feels comforting.\nImagine this part of you receiving kindness, the way dry ground receives gentle rain.",
      "You don't have to create the feeling.\nJust allow yourself to be open to receiving it.",
      { pause: 6 },
      "Take one more slow breath.\nQuietly repeat to yourself:\n\n\"May I give myself the same care I would give someone I love.\"\n\"May I be gentle with myself today.\"\n\"May I remember that I deserve compassion too.\"",
      "Take one final breath.\nNotice how your body feels.\nWhatever you noticed today is enough.\nThank yourself for taking this moment to care for yourself.",
      "✨ Offering yourself kindness, especially during stressful moments, can help build self-compassion over time. You deserve the same care you'd give someone else."
    ]}
  ];

  /* ---------------- Badges (28) ---------------- */
  const badges = [
    "\"Survived Monday\" 🥴", "\"Mindful-ish\" 🍃", "\"Said Something Nice About Life\" ✨",
    "\"Emotions? Faced.\" 💪😤", "\"Didn't Ghost the Chatbot\" 👻💬", "\"Good Vibes in Progress\" 🌈",
    "\"Emotional Forecast: Good Vibes Incoming\" 🌈☀️", "\"Answered Honestly\" 💭", "\"Emotional Acrobat\" 🎪",
    "\"Looked Inward, Didn't Panic\" 🪞", "\"Won the Day, Technically\" 🏅", "\"I Showed Up\" 🫶",
    "\"The Vibe Is... Complex\" ☁️🫠", "\"Sat With It\" 🧘", "\"Feelings: Acknowledged\" 🫡",
    "\"Touched Grass\" 🌿", "\"Slowed Down for a Sec\" 🐢", "\"Noticed the Sky Today\" ☁️",
    "\"Chose Optimism (Today, At Least)\" 🌻", "\"New Thing, Who Dis\" 🆕", "\"Thought About It From Every Angle\" 🔍",
    "\"Doing Just Fine, Thanks\" 🙂", "\"Held It Together (Mostly)\" 🧵", "\"Breathed (on Purpose)\" 🌬️",
    "\"Quiet Mind, Loud World\" 🤫", "\"Glass Half... We're Working On It\" 🥛",
    "\"Chose Kindness — Toward Yourself\" 💛", "\"Did the Brave Thing\" 🦁"
  ];

  /* ---------------- Affirmations (completion / encouragement) ---------------- */
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

  /* ---------------- Behavioral Activation (28 challenges) ---------------- */
  const baChallenges = [
    { text: "Daily challenge: Text someone you've been meaning to catch up with 👋",
      checkin: "Did you get a chance to catch up with them? How'd it go — or if not, what got in the way? 🤔",
      done: "Reaching out isn't always easy, so I'm glad you followed through and made it happen.",
      notDone: "That's okay — missing one day doesn't mean you've missed your chance. You can always try again when you're ready." },
    { text: "Daily challenge: Step outside for a couple minutes. Feel the air. Look closer at your surroundings. See if you can notice something new. 🚶‍♀️",
      checkin: "Did you get a chance to see something new? What was it? 👀",
      done: "Crazy how much is sitting there just waiting for someone to slow down and notice.",
      notDone: "No worries! As you go about your day today, you can try to notice the beautiful surroundings! :)" },
    { text: "Your challenge today: Put on a song you love and do nothing else for 3 minutes. Just listen. (Or dance if that's the vibe 🕺)",
      checkin: "What song did you put on? Did it turn into a dance party? 🎶🎶",
      done: "Great choice — whether it was just a vibe or a dance sesh, it sounds like a solid 3 minutes.",
      notDone: "No worries at all — you can always try again when the time is right." },
    { text: "Today's small challenge: Finish one thing on your to-do list. The smallest one counts ✅",
      checkin: "Did you get the chance to knock something off that to-do list? 📋✅",
      done: "Small tasks are also real progress — as long as the list is getting shorter you're doing something right.",
      notDone: "Don't sweat it — hitting pause today doesn't mean you're back at square one. You can always pick right back up whenever you're ready." },
    { text: "Your challenge today: Try something new — it could be food, a coffee shop or restaurant, an activity. 🎉",
      checkin: "What'd you end up trying? Would you want to try it again or never speak of it?",
      done: "Whether it was a new favorite or a great story for later, trying is a win.",
      notDone: "That is 100% okay — not completing it now doesn't mean it's off the table forever. You can always take another swing at it when you're ready." },
    { text: "Daily challenge: Organize one thing. It could be a drawer, your desk, or your phone home screen. Small wins count! ⭐️",
      checkin: "What'd you get organized? Does it feel better to have it out of the way? 😌",
      done: "One less messy thing to think about — incredible relief.",
      notDone: "All good! Hitting pause today doesn't erase how far you've already come. You can always try again when you're ready." },
    { text: "Daily challenge: Make something small — a doodle, a playlist, a simple snack, anything. Just create for a few minutes 🎨",
      checkin: "Hey Picasso, did you get the chance to make something? 👩‍🎨",
      done: "Regardless of whether or not it is worthy of being in a gallery, you made something that didn't exist before. I think that's cool.",
      notDone: "No worries, you can always tackle it when you're up for it!" },
    { text: "Daily challenge: Reach out and make plans with someone for the weekend. 📅",
      checkin: "Just wanted to ask if you ended up making any weekend plans? 🗓️",
      done: "Having something to look forward to is always exciting.",
      notDone: "No stress, you can always try again when the time feels right." },
    { text: "Daily challenge: Rewatch a favorite movie scene or episode that always makes you smile 🍿",
      checkin: "What'd you end up rewatching? Did it hit the way you remembered?",
      done: "There's something so comforting about a scene you already know by heart — glad you gave yourself that.",
      notDone: "No worries, you can always give it another shot whenever you find the time for it." },
    { text: "Daily challenge: Send someone a song that reminds you of them 🎶",
      checkin: "Did you send it? What made you think of them?",
      done: "Songs are such a specific way to say \"I was thinking of you\" without needing extra words. Nice one.",
      notDone: "Don't even sweat it, you can always pick it back up when you're up for it!" },
    { text: "Daily challenge: Send someone a meme that you thought was funny 😂",
      checkin: "Did you send it? What'd they think about it?",
      done: "Sharing something that made you laugh is a nice gift — glad you passed it on.",
      notDone: "All good, you can always jump back into it whenever you're up for it!" },
    { text: "Daily challenge: Play a fun game or puzzle you haven't touched in a while 🕹️🧩🎲",
      checkin: "Did you dust it off? How was it going back to something familiar?",
      done: "Revisiting something familiar definitely hits — brings you back to a different time.",
      notDone: "No big deal! That challenge is going nowhere, and neither am I 😊" },
    { text: "Daily challenge: Listen to one song you've never heard before. Any genre, any era 🎧",
      checkin: "What'd you end up playing? Was it 🔥?",
      done: "Can't find a hidden gem without looking — always worth trying just to see what happens.",
      notDone: "You got this — you can circle back to it whenever you're ready. That is totally okay." },
    { text: "Daily challenge: Make a playlist with a theme — late night drive, rainy day, movie montage, anything 🚗",
      checkin: "What was the theme you went with? What inspired you?",
      done: "A themed playlist takes a lot of thought — pretty cool that you were able to do it.",
      notDone: "No worries at all, you can always circle around to it whenever you're up for it." },
    { text: "Daily challenge: Cook or enjoy your favorite meal today and take your time enjoying it 🍳",
      checkin: "What'd you make or have? Did you actually get to slow down with it?",
      done: "Taking the time to actually enjoy making — and eating — that's a win.",
      notDone: "That meal will still be waiting for when you and your stomach are ready." },
    { text: "Daily challenge: Go somewhere nearby you've never actually taken time to explore 🚶",
      checkin: "Where'd you end up? Was it worth the trip?",
      done: "Sometimes the coolest things can be right under our noses.",
      notDone: "It'll still be there when curiosity strikes." },
    { text: "Daily challenge: Make a \"favorites\" list: favorite songs, scenes, meals, memories, games, moments lately 📝",
      checkin: "What was the list about?",
      done: "There's something wonderful about putting down your favorite things in writing.",
      notDone: "Whenever you're ready to make that list, all the things are already in your head." },
    { text: "Daily challenge: Pause and notice 3 things you can hear, smell, and see right now 🎧",
      checkin: "What did you notice?",
      done: "Great job — slowing down to notice something significant in your surroundings is tough.",
      notDone: "The moment to pause and notice something is still waiting for you whenever you're ready." },
    { text: "Your challenge today: Write down one thing you accomplished recently, even if it felt small ✍️",
      checkin: "If you're comfortable sharing, I'd love to know what you wrote?",
      done: "Writing down something you did, however small or big, is a reminder of what you're capable of.",
      notDone: "That accomplishment happened whether you wrote it down or not — you don't need proof for it to count." },
    { text: "Daily challenge: Open your camera roll and favorite 5 photos that make you happy 📸",
      checkin: "What was special about these pictures?",
      done: "Sounds like a nice little scroll down memory lane.",
      notDone: "Those photos aren't going anywhere — you always have another chance to scroll down memory lane." },
    { text: "Your challenge today: Spend 5 minutes sitting somewhere quiet without needing to \"do\" anything 🌤️",
      checkin: "How did the quiet sitting go?",
      done: "Being still and doing absolutely nothing is an underrated activity — glad you gave it a chance.",
      notDone: "That quiet moment is still available when things slow down enough for you to use it." },
    { text: "Your challenge today: Leave a kind note to yourself, somewhere you'll see later 💌",
      checkin: "What did you write about? Did you find it for yourself yet?",
      done: "Future you is lucky to have past you looking out for yourself like that.",
      notDone: "Don't sweat it — being kind to yourself does not have a deadline." },
    { text: "Your challenge today: Put on comfy clothes and let yourself relax for a bit 🛋️",
      checkin: "What are your favorite comfy clothes?",
      done: "Giving yourself the option to just be comfortable and relax is self-care too.",
      notDone: "Whenever you've got some room for it, the comfy clothes and the doing-nothing are waiting for you." },
    { text: "Your challenge today: Make a small \"try later\" list — a café, recipe, event, or new experience 🌱",
      checkin: "What did you add to the list?",
      done: "Having a list of things to look forward to sounds like an awesome list.",
      notDone: "No worries — some days thinking about new things just isn't the vibe." },
    { text: "Daily challenge: Take a quick water break before moving on to the next thing 💧✨",
      checkin: "Did you take a swig of that water?",
      done: "Being hydrated is always great.",
      notDone: "Maybe when you have a couple minutes you can take a sip." },
    { text: "Daily challenge: Spend some time tidying the space where you rest ✨",
      checkin: "Did your space get a refresh?",
      done: "A tidier space to rest in has a bigger impact than most people would think.",
      notDone: "The space will still be there later — probably still in need of some tidying." },
    { text: "Daily challenge: Read a chapter of a book you're into — or spend a few minutes finding your next read 📚",
      checkin: "Did you get a chance to read, or find something new for the list?",
      done: "There is honestly nothing better than getting lost in a good chapter or finding a new book to look forward to.",
      notDone: "The pages aren't going anywhere; you can jump into a new book whenever you're ready!" },
    { text: "Daily challenge: Spend a few minutes doing something you really enjoy — not to be productive, do it because you love it ❤️",
      checkin: "Did you end up doing anything fun? Did you lose track of time while doing it?",
      done: "Whatever it was, it sounds like exactly what you needed.",
      notDone: "Whatever you love doing is always waiting for when you have some time." }
  ];

  /* ---------------- Fallback reflections (if Gemini is unavailable) ---------------- */
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
    greetings, moodMetaphors, moodWordsPositive, moodWordsNegative, moodWordsNeutral,
    moodAcks, moodFollowUps,
    funFactsStatement, funFactTapbacks, funFactsTrivia,
    swapOffers, values,
    savoringPresent, savoringFuture, gratitudePairs,
    meaningLightPairs, meaningDeepPairs, meaningValuesPair, cancerPrompts,
    mindfulnessPairs, mbscPairs,
    badges, affirmations, baChallenges, fallbackReflections
  };
})();
