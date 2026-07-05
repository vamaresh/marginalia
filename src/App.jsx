import { storage } from "./lib/storage";
import { isConfigured as onenoteConfigured, getAccessToken, fetchOneNoteData } from "./lib/onenote";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  BookOpen, ChevronRight, ChevronDown, Search, RefreshCw, Volume2, VolumeX,
  Settings2, X, Play, Pause, Sun, Moon, Coffee, Type, Check, Loader2,
  Headphones, ArrowLeft, Sparkles, Link2, CheckCircle2, Square, Clock,
  PanelLeftClose, PanelLeft, Quote, AlertTriangle, Pencil, Palette,
  Bold, Italic, Underline, Highlighter
} from "lucide-react";

/* ---------------------------------------------------------------------- */
/* Palette + type tokens                                                   */
/* ---------------------------------------------------------------------- */
const C = {
  paper: "#F3ECDA",
  paperEdge: "#E5D9BC",
  ink: "#25211A",
  inkSoft: "#5C5343",
  gold: "#A8862E",
  goldDeep: "#8A6D22",
  teal: "#2B5D5A",
  tealDeep: "#1E4341",
  rust: "#8C4A2F",
  olive: "#5C6B2E",
  plum: "#5B4570",
  night: "#1B1A17",
  nightText: "#E7DEC7",
  sepiaBg: "#ECDFC2",
  sepiaInk: "#3A2E1B",
  cream: "#FAF6EC",
  line: "#DACCA5",
};

const FONTS = {
  display: "'Fraunces', Georgia, serif",
  serif: "'Source Serif 4', Georgia, serif",
  sans: "'Inter', system-ui, sans-serif",
};

const BG_SWATCHES = [
  { v: "#FBF3E4" },
  { v: "#EAF1EC" },
  { v: "#F3E9F5" },
  { v: "#FDECEA" },
  { v: "#EAF2F8" },
];

/* ---------------------------------------------------------------------- */
/* Sample library — stands in for imported OneNote content                 */
/* ---------------------------------------------------------------------- */
const INITIAL_NOTEBOOKS = [
  {
    id: "nb-work",
    name: "Work",
    color: C.gold,
    sections: [
      {
        id: "sec-roadmap",
        name: "Product Roadmap",
        pages: [
          {
            id: "p-q3",
            title: "Q3 Planning Notes",
            edited: "2 days ago",
            content: [
              "Main goal for Q3 is shipping the redesigned onboarding flow before the September release. Design has the first clickable prototype ready by next Friday, and we agreed engineering will start on the skeleton screens in parallel rather than waiting for final visuals.",
              "Biggest open risk is the analytics migration. If the new event schema isn't finalized by mid-July, we lose our ability to compare onboarding completion rates before and after launch, which makes it much harder to prove the redesign actually worked.",
              "Action items: confirm event schema with data team by July 10, get two more usability sessions booked for the new flow, and decide whether the empty-state illustrations are in scope for this quarter or push to Q4.",
            ],
          },
          {
            id: "p-retro",
            title: "Sprint Retro Ideas",
            edited: "5 days ago",
            content: [
              "Retro theme this cycle: too many things were 'almost done' at demo day. Half the team felt the definition of done wasn't being enforced consistently, especially around edge-case testing.",
              "Idea worth trying: a shared 'done means' checklist pinned to the board, and a two-minute call-out at standup if a ticket has been in review for more than a day.",
              "Also floated: shorter sprints (one week instead of two) just for the current redesign work, since scope keeps shifting mid-sprint anyway. Nobody hated the idea, but nobody loved it either.",
            ],
          },
        ],
      },
      {
        id: "sec-meetings",
        name: "Meeting Notes",
        pages: [
          {
            id: "p-sync",
            title: "Weekly Sync — June 30",
            edited: "1 week ago",
            content: [
              "Marketing wants the launch announcement drafted two weeks earlier than originally planned, to line up with a partner's press cycle. Engineering pushed back gently — two weeks earlier means feature-freeze moves up too.",
              "Compromise: we freeze the core onboarding flow now and treat everything else as optional polish that can slip without affecting the announcement date.",
              "Follow-up: someone needs to own the partner-timing conversation directly, since it keeps changing every time it's relayed secondhand.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "nb-growth",
    name: "Personal Growth",
    color: C.teal,
    sections: [
      {
        id: "sec-books",
        name: "Book Notes",
        pages: [
          {
            id: "p-atomic",
            title: "Atomic Habits — Key Takeaways",
            edited: "3 days ago",
            content: [
              "The core idea: habits are the compound interest of self-improvement. A 1% change is invisible day to day but enormous over a year, which is exactly why most people give up too early — they expect linear progress from a system that's actually exponential.",
              "The four laws stuck with me: make it obvious, make it attractive, make it easy, make it satisfying. Reversing each one is the fastest way to break a bad habit — make it invisible, unattractive, difficult, unsatisfying.",
              "Practical takeaway I want to actually use: habit stacking. Attach a new habit to an existing one — 'after I pour my morning coffee, I will write down one priority for the day.' The existing habit becomes the trigger, so I don't have to rely on willpower to remember.",
            ],
          },
          {
            id: "p-deepwork",
            title: "Deep Work — Summary",
            edited: "1 week ago",
            content: [
              "Central argument: the ability to focus without distraction is becoming rare and, because it's rare, increasingly valuable. Most knowledge work rewards shallow, reactive busyness instead of protecting time for hard, focused thinking.",
              "The book pushes for scheduling deep work like a meeting you can't cancel, and treating context-switching — email, chat, notifications — as something to batch rather than respond to instantly.",
              "One idea I disagreed with initially but now think has merit: boredom tolerance. If you fill every idle moment with your phone, your brain loses the ability to sit with a hard problem long enough to actually solve it.",
            ],
          },
        ],
      },
      {
        id: "sec-journal",
        name: "Journal",
        pages: [
          {
            id: "p-focus",
            title: "Reflections on Focus",
            edited: "yesterday",
            content: [
              "Noticed this week that my best ideas show up on walks, never at my desk. Might be worth deliberately starting harder problems with a walk instead of treating it as a break I take once I'm already stuck.",
              "Also noticed I check messages out of anxiety more than necessity — most of what's waiting could wait another hour. Going to try muting notifications for the first ninety minutes of the day and see if anything actually breaks.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "nb-travel",
    name: "Travel",
    color: C.rust,
    sections: [
      {
        id: "sec-japan",
        name: "Japan Trip 2026",
        pages: [
          {
            id: "p-tokyo",
            title: "Tokyo Itinerary Draft",
            edited: "4 days ago",
            content: [
              "Landing in Tokyo on a Thursday morning, so the plan is to keep day one light — check in, walk around the neighborhood, early dinner, sleep off the jet lag properly instead of pushing through.",
              "Day two: Senso-ji at opening time before the crowds, then Yanaka Ginza for a slower, quieter contrast to Asakusa. Evening open for whatever we're in the mood for.",
              "Still deciding between a day trip to Nikko or Kamakura — Nikko has the bigger shrines, Kamakura is closer and has the coast. Leaning Kamakura since we'll already be shrine-heavy from Kyoto later in the trip.",
            ],
          },
          {
            id: "p-packing",
            title: "Packing List & Notes",
            edited: "2 days ago",
            content: [
              "Packing light this time — one carry-on, laundry every four or five days instead of hauling clothes for the whole trip. Need to actually find a coin laundromat near the first hotel in advance.",
              "Don't forget: portable battery pack, a physical IC card top-up in case the phone-based one has issues, and comfortable shoes that are already broken in — not new ones bought right before the trip.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "nb-recipes",
    name: "Recipes",
    color: C.olive,
    sections: [
      {
        id: "sec-weeknight",
        name: "Weeknight Dinners",
        pages: [
          {
            id: "p-pasta",
            title: "Weekend Pasta alle Vongole",
            edited: "6 days ago",
            content: [
              "Purge the clams in salted water for at least thirty minutes before cooking — skipping this step is the difference between a clean briny sauce and one that's gritty and unpleasant.",
              "Garlic and chili flakes go in the oil low and slow, never high heat, or the garlic turns bitter before the clams even hit the pan. White wine deglazes, then clams go in covered until they open.",
              "Save a full cup of starchy pasta water — this sauce is thin on its own, and the starch is what pulls it together into something that actually clings to the noodles instead of pooling at the bottom of the bowl.",
            ],
          },
          {
            id: "p-chicken",
            title: "Sheet-Pan Chicken Notes",
            edited: "2 weeks ago",
            content: [
              "Cutting the vegetables smaller than feels natural is the fix for the usual sheet-pan problem — chicken done, vegetables still raw. Smaller pieces cook at closer to the same rate.",
              "Pat the chicken fully dry before it goes on the pan. Skin gets genuinely crisp instead of steaming, which was the one change that made this dish go from fine to actually good.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "nb-sermons",
    name: "Sermons",
    color: C.plum,
    isSermon: true,
    sections: [
      {
        id: "sec-2026-messages",
        name: "2026 Messages",
        pages: [
          {
            id: "s-grace",
            title: "Grace That Isn't Fair",
            edited: "3 weeks ago",
            scripture: "Ephesians 2:1-10",
            theme: "Grace, unmerited favor",
            illustrations: [
              "The parable of the workers paid the same wage regardless of hours worked",
              "A father quietly paying off his adult son's debt without being asked",
            ],
            content: [
              "Grace is the one thing in the text we can't earn our way into, and that's exactly what makes it hard to preach — every instinct in us wants to add a condition to it.",
              "Verse 8 is doing more work than we usually give it credit for: 'by grace you have been saved, through faith, and this is not your own doing.' Even the faith is described as a gift, not a transaction we initiated.",
              "The temptation in application is to turn grace into a reward for good behavior after the fact. Resist that. The point isn't 'be good because you're saved,' it's 'you are saved, and that changes what good even means to you now.'",
            ],
          },
          {
            id: "s-faith-works",
            title: "Faith With Hands and Feet",
            edited: "2 weeks ago",
            scripture: "James 2:14-26",
            theme: "Faith and works",
            illustrations: [
              "A lifeguard who has full faith the rope will hold, but still throws it",
              "A seed that has to actually be planted to prove it was ever alive",
            ],
            content: [
              "James isn't contradicting Paul here, even though it can feel that way on a first read. Paul is answering 'how are we made right with God,' James is answering 'what does real faith look like once it's alive in someone.'",
              "'Faith without works is dead' is a diagnostic statement, not a formula for earning anything. Dead faith isn't lesser faith — it's the absence of the thing entirely, the same way a body without breath isn't a quieter body, it's a corpse.",
              "Application lands best as a question, not a checklist: not 'have you done enough,' but 'if someone watched your last month, would they see any evidence that you actually believe what you say you believe?'",
            ],
          },
          {
            id: "s-prodigal",
            title: "The Long Walk Home",
            edited: "10 days ago",
            scripture: "Luke 15:11-32",
            theme: "Repentance, the Father's welcome",
            illustrations: [
              "In that culture, a father running was undignified — he'd have to hike up his robes, exposing his legs, something a patriarch simply didn't do in public",
              "The older brother's resentment as a mirror for religious self-righteousness",
            ],
            content: [
              "The scandal of this parable isn't the son leaving — that's almost expected. It's the father running. Landowners in that culture didn't run to anyone; that son should have walked the rest of the way and bowed.",
              "The younger son rehearses a whole speech about becoming a hired servant, and the father never even lets him finish it. Grace interrupts our attempts to negotiate our way back in.",
              "The older brother is the harder character to preach because most regular church attenders are closer to him than the prodigal — obedient, resentful, and standing outside the party he thinks he earned an invitation to.",
            ],
          },
          {
            id: "s-titus",
            title: "Renewed, Not Just Reformed",
            edited: "6 days ago",
            scripture: "Titus 3:3-7",
            theme: "Regeneration, grace applied ongoing",
            illustrations: [
              "The difference between renovating an old house and pouring a new foundation entirely",
              "The parable of the workers paid the same wage regardless of hours worked",
            ],
            content: [
              "Verse 5 is precise on purpose: 'he saved us, not because of works done by us in righteousness, but according to his own mercy.' Paul keeps returning to this because the human instinct to self-justify never really goes away, even after conversion.",
              "'The washing of regeneration and renewal' is a rebirth image, not a renovation image. A renovation keeps the original structure and improves it. Regeneration means the old structure wasn't salvageable to begin with — this is a new foundation, not a fresh coat of paint.",
              "Worth connecting for the congregation: this is the same mercy from the Ephesians 2 passage a few weeks back, applied specifically to how we keep living, not just how we got saved in the first place.",
            ],
          },
          {
            id: "s-galatians",
            title: "Keeping in Step",
            edited: "2 days ago",
            scripture: "Galatians 5:16-25",
            theme: "Walking by the Spirit, fruit vs. works of the flesh",
            illustrations: [
              "Dance partners staying in step with a lead, rather than fighting for control of the rhythm",
              "A plant naturally bearing fruit compared to a factory manufacturing plastic fruit",
            ],
            content: [
              "Paul's list of 'works of the flesh' in verse 19 is oddly specific and a little uncomfortable to read out loud — it's not just the obvious sins, it's also rivalry, jealousy, and dissensions. Things a polite congregation would never call sin out loud.",
              "The 'fruit of the Spirit' language matters: fruit grows, it isn't manufactured. You can't grit your teeth and produce patience the way you'd force a deadline. It's evidence of what's rooted, not an achievement to hit.",
              "'Keep in step with the Spirit' in verse 25 is a walking metaphor, following someone else's pace instead of setting your own and asking God to bless it after the fact.",
            ],
          },
        ],
      },
    ],
  },
];

const HOSTS = {
  Maya: { color: C.teal },
  Leo: { color: C.gold },
};

/* ---------------------------------------------------------------------- */
/* Helpers                                                                  */
/* ---------------------------------------------------------------------- */
function findPage(notebooks, pageId) {
  for (const nb of notebooks) {
    for (const sec of nb.sections) {
      for (const pg of sec.pages) {
        if (pg.id === pageId) return { notebook: nb, section: sec, page: pg };
      }
    }
  }
  return null;
}

function splitSentences(text) {
  const matches = text.match(/[^.!?]+[.!?]+(\s+|$)/g);
  return matches && matches.length ? matches.map((s) => s.trim()) : [text];
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function paragraphsToHtml(content) {
  return content.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToParagraphs(html) {
  const blocks = html.split(/<\/(?:p|div|h[1-6])>/i);
  const paras = [];
  blocks.forEach((chunk) => {
    const text = stripTags(chunk);
    if (text) paras.push(text);
  });
  return paras.length ? paras : [stripTags(html)];
}

function pageBodyText(page) {
  return page.html ? stripTags(page.html) : page.content.join(" ");
}

function pageSearchText(page) {
  const extras = [page.scripture, page.theme, ...(page.illustrations || [])].filter(Boolean).join(" ");
  return `${page.title} ${pageBodyText(page)} ${extras}`.toLowerCase();
}

function findSnippet(page, query) {
  const body = pageBodyText(page);
  const q = query.toLowerCase();
  const idx = body.toLowerCase().indexOf(q);
  if (idx === -1) return null;
  const start = Math.max(0, idx - 28);
  const end = Math.min(body.length, idx + q.length + 28);
  return `${start > 0 ? "…" : ""}${body.slice(start, end).trim()}${end < body.length ? "…" : ""}`;
}

function countTotalSentences(page) {
  return page.content.reduce((sum, p) => sum + splitSentences(p).length, 0);
}

/* ---------------------------------------------------------------------- */
/* Main App                                                                 */
/* ---------------------------------------------------------------------- */
export default function App() {
  const [notebooks, setNotebooks] = useState(INITIAL_NOTEBOOKS);
  const [expandedNb, setExpandedNb] = useState({ "nb-work": true });
  const [expandedSec, setExpandedSec] = useState({ "sec-roadmap": true });
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [query, setQuery] = useState("");

  const [settings, setSettings] = useState({
    theme: "light",
    fontFamily: "serif",
    fontSize: 19,
    lineHeight: 1.75,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsLoaded = useRef(false);

  const [syncOpen, setSyncOpen] = useState(false);
  const [syncStep, setSyncStep] = useState("intro"); // intro | connecting | found | importing | done | error
  const [lastSynced, setLastSynced] = useState(null);
  const [discovered, setDiscovered] = useState([]);
  const [syncError, setSyncError] = useState(null);
  const [syncCounts, setSyncCounts] = useState({ notebooks: 0, sections: 0, pages: 0 });

  const [reading, setReading] = useState({ active: false, idx: -1 });
  const [podcastOpen, setPodcastOpen] = useState(false);
  const [podcastStatus, setPodcastStatus] = useState("idle"); // idle | loading | ready | error
  const [podcastScript, setPodcastScript] = useState(null);
  const [podcastPlaying, setPodcastPlaying] = useState(false);
  const [podcastIdx, setPodcastIdx] = useState(-1);
  const podcastCache = useRef({});
  const stopFlag = useRef(false);
  const voicesRef = useRef([]);

  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [sermonOpen, setSermonOpen] = useState(false);
  const [sermonStatus, setSermonStatus] = useState("idle"); // idle | loading | ready | error
  const [sermonData, setSermonData] = useState(null);
  const sermonCache = useRef({});

  /* -------------------- load/save reader settings -------------------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await storage.get("marginalia-settings");
        if (res && res.value) setSettings(JSON.parse(res.value));
      } catch (e) {
        /* no saved settings yet */
      }
      settingsLoaded.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!settingsLoaded.current) return;
    storage.set("marginalia-settings", JSON.stringify(settings)).catch(() => {});
  }, [settings]);

  /* -------------------- load persisted note edits -------------------- */
  useEffect(() => {
    (async () => {
      try {
        const listRes = await storage.list("note:");
        const keys = (listRes && listRes.keys) || [];
        if (!keys.length) return;
        const entries = {};
        for (const k of keys) {
          try {
            const r = await storage.get(k);
            if (r && r.value) entries[k.replace("note:", "")] = JSON.parse(r.value);
          } catch (e) {
            /* skip bad entry */
          }
        }
        if (Object.keys(entries).length) {
          setNotebooks((prev) =>
            prev.map((nb) => ({
              ...nb,
              sections: nb.sections.map((sec) => ({
                ...sec,
                pages: sec.pages.map((pg) =>
                  entries[pg.id]
                    ? { ...pg, html: entries[pg.id].html || pg.html, bgColor: entries[pg.id].bgColor || pg.bgColor }
                    : pg
                ),
              })),
            }))
          );
        }
      } catch (e) {
        /* nothing saved yet */
      }
    })();
  }, []);

  function applyPageUpdate(pageId, patch) {
    setNotebooks((prev) => {
      const next = prev.map((nb) => ({
        ...nb,
        sections: nb.sections.map((sec) => ({
          ...sec,
          pages: sec.pages.map((pg) => (pg.id === pageId ? { ...pg, ...patch } : pg)),
        })),
      }));
      const updated = next.flatMap((nb) => nb.sections).flatMap((s) => s.pages).find((p) => p.id === pageId);
      if (updated) {
        storage
          .set(`note:${pageId}`, JSON.stringify({ html: updated.html || null, bgColor: updated.bgColor || null }))
          .catch(() => {});
      }
      return next;
    });
  }

  /* -------------------- voices -------------------- */
  useEffect(() => {
    function loadVoices() {
      voicesRef.current = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    }
    loadVoices();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  function pickVoice(preferIdx) {
    const voices = voicesRef.current || [];
    if (!voices.length) return null;
    return voices[preferIdx % voices.length];
  }

  /* -------------------- derived -------------------- */
  const current = selectedPageId ? findPage(notebooks, selectedPageId) : null;

  const filteredNotebooks = useMemo(() => {
    if (!query.trim()) return notebooks;
    const q = query.toLowerCase();
    return notebooks
      .map((nb) => ({
        ...nb,
        sections: nb.sections
          .map((sec) => ({
            ...sec,
            pages: sec.pages.filter((p) => pageSearchText(p).includes(q)),
          }))
          .filter((sec) => sec.pages.length > 0),
      }))
      .filter((nb) => nb.sections.length > 0);
  }, [notebooks, query]);

  const recentPages = useMemo(() => {
    const all = [];
    notebooks.forEach((nb) =>
      nb.sections.forEach((sec) =>
        sec.pages.forEach((pg) => all.push({ ...pg, nb, sec }))
      )
    );
    return all.slice(0, 6);
  }, [notebooks]);

  const totalPages = recentPages.length
    ? notebooks.reduce(
        (s, nb) => s + nb.sections.reduce((s2, sec) => s2 + sec.pages.length, 0),
        0
      )
    : 0;

  /* -------------------- navigation -------------------- */
  function openPage(pageId) {
    stopReadAloud();
    stopPodcast();
    setPodcastOpen(false);
    setSermonOpen(false);
    setSermonStatus("idle");
    setSelectedPageId(pageId);
  }

  function goHome() {
    stopReadAloud();
    stopPodcast();
    setPodcastOpen(false);
    setSermonOpen(false);
    setSermonStatus("idle");
    setSelectedPageId(null);
  }

  /* -------------------- read aloud (single voice) -------------------- */
  const sentences = useMemo(() => {
    if (!current) return [];
    const paragraphs = current.page.html ? htmlToParagraphs(current.page.html) : current.page.content;
    const flat = [];
    paragraphs.forEach((para, pIdx) => {
      splitSentences(para).forEach((s) => flat.push({ text: s, para: pIdx }));
    });
    return flat;
  }, [current]);

  function stopReadAloud() {
    stopFlag.current = true;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setReading({ active: false, idx: -1 });
  }

  function speakSentence(i) {
    if (!window.speechSynthesis || i >= sentences.length) {
      setReading({ active: false, idx: -1 });
      return;
    }
    const utter = new SpeechSynthesisUtterance(sentences[i].text);
    const v = pickVoice(0);
    if (v) utter.voice = v;
    utter.rate = 0.98;
    utter.onend = () => {
      if (!stopFlag.current) speakSentence(i + 1);
    };
    setReading({ active: true, idx: i });
    window.speechSynthesis.speak(utter);
  }

  function toggleReadAloud() {
    if (reading.active) {
      stopReadAloud();
    } else {
      stopFlag.current = false;
      speakSentence(0);
    }
  }

  /* -------------------- podcast generation + playback -------------------- */
  async function openPodcast() {
    setPodcastOpen(true);
    if (!current) return;
    const cacheKey = current.page.id;

    if (podcastCache.current[cacheKey]) {
      setPodcastScript(podcastCache.current[cacheKey]);
      setPodcastStatus("ready");
      return;
    }

    try {
      const stored = await storage.get(`podcast:${cacheKey}`);
      if (stored && stored.value) {
        const parsed = JSON.parse(stored.value);
        podcastCache.current[cacheKey] = parsed;
        setPodcastScript(parsed);
        setPodcastStatus("ready");
        return;
      }
    } catch (e) {
      /* nothing cached */
    }

    generatePodcast(current.page, cacheKey);
  }

  async function generatePodcast(page, cacheKey) {
    setPodcastStatus("loading");
    setPodcastScript(null);
    const prompt = `You are producing a short two-host audio podcast script based on a personal note. Hosts are Maya (curious, asks clarifying questions) and Leo (analytical, adds context and connections). They are warm, a little playful, and clearly enjoy talking to each other.

Note title: "${page.title}"
Note content:
${page.content.join("\n\n")}

Write a natural, engaging 8 to 12 line back-and-forth conversation between Maya and Leo discussing this note: summarize it, highlight the most useful or interesting points, and add light personality. Keep each line under 35 words. Respond with ONLY a JSON array, no markdown fences, no preamble, no explanation, in exactly this format:
[{"speaker":"Maya","text":"..."},{"speaker":"Leo","text":"..."}]`;

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await resp.json();
      const text = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (!Array.isArray(parsed) || !parsed.length) throw new Error("empty script");

      podcastCache.current[cacheKey] = parsed;
      setPodcastScript(parsed);
      setPodcastStatus("ready");
      storage.set(`podcast:${cacheKey}`, JSON.stringify(parsed)).catch(() => {});
    } catch (err) {
      setPodcastStatus("error");
    }
  }

  function stopPodcast() {
    stopFlag.current = true;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setPodcastPlaying(false);
    setPodcastIdx(-1);
  }

  function playPodcastLine(i) {
    if (!podcastScript || i >= podcastScript.length) {
      setPodcastPlaying(false);
      setPodcastIdx(-1);
      return;
    }
    const line = podcastScript[i];
    const utter = new SpeechSynthesisUtterance(line.text);
    const v = pickVoice(line.speaker === "Maya" ? 0 : 1);
    if (v) utter.voice = v;
    utter.pitch = line.speaker === "Maya" ? 1.08 : 0.92;
    utter.rate = 1;
    utter.onend = () => {
      if (!stopFlag.current) playPodcastLine(i + 1);
    };
    setPodcastIdx(i);
    window.speechSynthesis.speak(utter);
  }

  function togglePodcastPlay() {
    if (podcastPlaying) {
      stopFlag.current = true;
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setPodcastPlaying(false);
    } else {
      stopFlag.current = false;
      setPodcastPlaying(true);
      playPodcastLine(podcastIdx >= 0 && podcastIdx < (podcastScript || []).length - 1 ? podcastIdx + 1 : 0);
    }
  }

  /* -------------------- sermon intelligence -------------------- */
  const sermonNotebook = notebooks.find((nb) => nb.isSermon);

  async function openSermonInsights() {
    setSermonOpen(true);
    if (!current) return;
    const cacheKey = current.page.id;

    if (sermonCache.current[cacheKey]) {
      setSermonData(sermonCache.current[cacheKey]);
      setSermonStatus("ready");
      return;
    }
    try {
      const stored = await storage.get(`sermon-insights:${cacheKey}`);
      if (stored && stored.value) {
        const parsed = JSON.parse(stored.value);
        sermonCache.current[cacheKey] = parsed;
        setSermonData(parsed);
        setSermonStatus("ready");
        return;
      }
    } catch (e) {
      /* nothing cached yet */
    }
    generateSermonInsights(current.page, cacheKey);
  }

  async function generateSermonInsights(page, cacheKey) {
    setSermonStatus("loading");
    setSermonData(null);

    const others = (sermonNotebook ? sermonNotebook.sections.flatMap((s) => s.pages) : []).filter(
      (p) => p.id !== page.id
    );
    const othersMeta = others
      .map(
        (p) =>
          `- id: ${p.id} | title: "${p.title}" | scripture: ${p.scripture} | theme: ${p.theme} | illustrations used: ${p.illustrations.join("; ")}`
      )
      .join("\n");

    const prompt = `You are a thoughtful preaching assistant helping a pastor see connections across their sermon archive. Here is the sermon they are currently working on:

Title: "${page.title}"
Scripture: ${page.scripture}
Theme: ${page.theme}
Illustrations already used in this sermon: ${page.illustrations.join("; ")}
Full notes:
${page.content.join("\n\n")}

Here are metadata summaries of the pastor's other past sermons (do not invent sermons not in this list):
${othersMeta || "(no other sermons yet)"}

Return ONLY a JSON object, no markdown fences, no preamble, in exactly this shape:
{
  "related": [{"id": "<id from the list above>", "reason": "<one sentence on why it connects thematically or scripturally>"}],
  "illustrationIdeas": ["<one or two fresh illustration or example ideas that would fit this sermon's theme, not already used anywhere in the list>"],
  "repeatedIllustrations": ["<any illustration in this sermon's list that has also appeared in another past sermon from the list above, phrased as a heads-up>"],
  "crossReferences": ["<other scripture passages worth cross-referencing for this theme>"]
}
Only include "related" entries whose id actually appears in the list above. Keep each string under 30 words. If a category has nothing genuine to include, return an empty array for it rather than inventing something.`;

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await resp.json();
      const text = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      const validIds = new Set(others.map((p) => p.id));
      parsed.related = (parsed.related || [])
        .filter((r) => validIds.has(r.id))
        .map((r) => ({ ...r, page: others.find((p) => p.id === r.id) }));

      sermonCache.current[cacheKey] = parsed;
      setSermonData(parsed);
      setSermonStatus("ready");
      storage.set(`sermon-insights:${cacheKey}`, JSON.stringify(parsed)).catch(() => {});
    } catch (err) {
      setSermonStatus("error");
    }
  }

  /* -------------------- real OneNote sync (Microsoft Graph) -------------------- */
  const NB_COLORS = [C.plum, C.teal, C.goldDeep, C.gold];

  async function runSync() {
    setSyncError(null);
    setSyncStep("connecting");
    try {
      const token = await getAccessToken();
      const data = await fetchOneNoteData(token, { colors: NB_COLORS });
      if (!data.length) {
        setSyncError("No OneNote notebooks with pages were found on this account.");
        setSyncStep("error");
        return;
      }
      setDiscovered(data);
      setSyncStep("found");
    } catch (err) {
      setSyncError(err.message || "Couldn't connect to OneNote.");
      setSyncStep("error");
    }
  }

  function importFromOneNote() {
    if (!discovered.length) return;
    setSyncStep("importing");

    setNotebooks((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      for (const nb of discovered) byId.set(nb.id, nb); // replace/add on re-sync
      return Array.from(byId.values());
    });

    const counts = discovered.reduce(
      (acc, nb) => {
        acc.notebooks += 1;
        acc.sections += nb.sections.length;
        acc.pages += nb.sections.reduce((s, sec) => s + sec.pages.length, 0);
        return acc;
      },
      { notebooks: 0, sections: 0, pages: 0 }
    );
    setSyncCounts(counts);

    setExpandedNb((e) => {
      const next = { ...e };
      discovered.forEach((nb) => {
        next[nb.id] = true;
      });
      return next;
    });
    setLastSynced(new Date());
    setSyncStep("done");
  }

  function closeSync() {
    setSyncOpen(false);
    setTimeout(() => {
      setSyncStep("intro");
      setSyncError(null);
    }, 300);
  }

  /* -------------------- theme resolution -------------------- */
  const theme = settings.theme;
  const readerBg = theme === "dark" ? C.night : theme === "sepia" ? C.sepiaBg : C.cream;
  const readerText = theme === "dark" ? C.nightText : theme === "sepia" ? C.sepiaInk : C.ink;
  const fontFamily = settings.fontFamily === "sans" ? FONTS.sans : FONTS.serif;

  const progressPct = current && sentences.length
    ? Math.round(((reading.idx + 1) / sentences.length) * 100)
    : 0;

  /* ---------------------------------------------------------------- */
  return (
    <div style={{ fontFamily: FONTS.sans, background: C.paperEdge }} className="h-screen w-full flex overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::selection { background: ${C.gold}55; }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 3px; }
        @keyframes pulse-dot { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
        @keyframes wave { 0%,100% { transform: scaleY(.4); } 50% { transform: scaleY(1); } }
        button { cursor: pointer; }
        button:focus-visible, input:focus-visible { outline: 2px solid ${C.gold}; outline-offset: 2px; }
      `}</style>

      {/* ---------------- Sidebar toggle handle ---------------- */}
      <button
        onClick={() => setSidebarOpen((s) => !s)}
        title={sidebarOpen ? "Hide notebooks" : "Show notebooks"}
        className="fixed z-40 w-7 h-7 rounded-full flex items-center justify-center"
        style={{
          top: 16,
          left: sidebarOpen ? 274 : 12,
          background: C.cream,
          border: `1px solid ${C.line}`,
          boxShadow: "0 2px 6px rgba(37,33,26,0.12)",
          transition: "left 0.22s ease",
        }}
      >
        {sidebarOpen ? <PanelLeftClose size={13} color={C.inkSoft} /> : <PanelLeft size={13} color={C.inkSoft} />}
      </button>

      {/* ---------------- Sidebar ---------------- */}
      <aside
        className="h-full flex-shrink-0 flex flex-col"
        style={{
          background: C.paper,
          borderRight: sidebarOpen ? `1px solid ${C.line}` : "none",
          width: sidebarOpen ? 288 : 0,
          overflow: "hidden",
          transition: "width 0.22s ease",
        }}
      >
      <div className="h-full flex flex-col" style={{ width: 288, flexShrink: 0 }}>
        <div className="p-4" style={{ borderBottom: `1px solid ${C.line}` }}>
          <button onClick={goHome} className="flex items-center gap-2 mb-3" style={{ background: "none", border: "none" }}>
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: C.ink }}
            >
              <BookOpen size={16} color={C.paper} />
            </div>
            <span style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 19, color: C.ink }}>
              Marginalia
            </span>
          </button>
          <div className="relative">
            <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: C.inkSoft }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes"
              className="w-full text-sm rounded-md py-2 pl-8 pr-3"
              style={{
                background: C.cream,
                border: `1px solid ${C.line}`,
                color: C.ink,
                fontFamily: FONTS.sans,
              }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2">
          {filteredNotebooks.map((nb) => {
            const nbOpen = query.trim() ? true : expandedNb[nb.id];
            return (
            <div key={nb.id} className="mb-1">
              <button
                onClick={() => setExpandedNb((e) => ({ ...e, [nb.id]: !e[nb.id] }))}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md"
                style={{ background: "none", border: "none", textAlign: "left" }}
              >
                {nbOpen ? (
                  <ChevronDown size={14} color={C.inkSoft} />
                ) : (
                  <ChevronRight size={14} color={C.inkSoft} />
                )}
                <span
                  className="w-2.5 h-6 rounded-sm flex-shrink-0"
                  style={{ background: nb.color }}
                />
                <span style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 14.5, color: C.ink }}>
                  {nb.name}
                </span>
                {nb.synced && (
                  <CheckCircle2 size={12} color={C.teal} style={{ marginLeft: "auto" }} />
                )}
              </button>

              {nbOpen && (
                <div className="ml-4 pl-2" style={{ borderLeft: `1px solid ${C.line}` }}>
                  {nb.sections.map((sec) => {
                    const secKey = sec.id;
                    const secOpen = query.trim() ? true : expandedSec[secKey];
                    return (
                      <div key={secKey}>
                        <button
                          onClick={() => setExpandedSec((e) => ({ ...e, [secKey]: !e[secKey] }))}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md"
                          style={{ background: "none", border: "none", textAlign: "left" }}
                        >
                          {secOpen ? (
                            <ChevronDown size={12} color={C.inkSoft} />
                          ) : (
                            <ChevronRight size={12} color={C.inkSoft} />
                          )}
                          <span style={{ fontSize: 13, color: C.inkSoft, fontWeight: 600 }}>
                            {sec.name}
                          </span>
                        </button>
                        {secOpen && (
                          <div className="ml-4">
                            {sec.pages.map((pg) => {
                              const titleMatch = !query.trim() || pg.title.toLowerCase().includes(query.toLowerCase());
                              const snippet = query.trim() && !titleMatch ? findSnippet(pg, query) : null;
                              return (
                                <button
                                  key={pg.id}
                                  onClick={() => openPage(pg.id)}
                                  className="w-full text-left px-2 py-1.5 rounded-md mb-0.5"
                                  style={{
                                    background: selectedPageId === pg.id ? C.cream : "none",
                                    border: "none",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 13,
                                      color: selectedPageId === pg.id ? C.ink : C.inkSoft,
                                      fontWeight: selectedPageId === pg.id ? 600 : 400,
                                      display: "block",
                                    }}
                                  >
                                    {pg.title}
                                  </span>
                                  {snippet && (
                                    <span style={{ fontSize: 11, color: C.inkSoft, opacity: 0.75, display: "block", marginTop: 1 }}>
                                      {snippet}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            );
          })}
        </div>

        <div className="p-3" style={{ borderTop: `1px solid ${C.line}` }}>
          <button
            onClick={() => setSyncOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium"
            style={{ background: C.ink, color: C.paper, border: "none" }}
          >
            <RefreshCw size={14} />
            Sync OneNote
          </button>
          {lastSynced && (
            <p className="text-xs mt-2 text-center" style={{ color: C.inkSoft }}>
              Last synced {lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      </div>
      </aside>

      {/* ---------------- Main ---------------- */}
      <main className="flex-1 h-full flex flex-col overflow-hidden" style={{ background: C.paperEdge }}>
        {!current ? (
          <HomeView
            notebooks={notebooks}
            recentPages={recentPages}
            totalPages={totalPages}
            onOpen={openPage}
            onSync={() => setSyncOpen(true)}
          />
        ) : (
          <ReaderView
            key={current.page.id}
            current={current}
            settings={settings}
            setSettings={setSettings}
            settingsOpen={settingsOpen}
            setSettingsOpen={setSettingsOpen}
            readerBg={readerBg}
            readerText={readerText}
            fontFamily={fontFamily}
            sentences={sentences}
            reading={reading}
            toggleReadAloud={toggleReadAloud}
            progressPct={progressPct}
            onBack={goHome}
            onPodcast={openPodcast}
            isSermon={!!current.notebook.isSermon}
            onSermonInsights={openSermonInsights}
            sidebarOpen={sidebarOpen}
            collapseSidebar={() => sidebarOpen && setSidebarOpen(false)}
            onSaveHtml={(html) => applyPageUpdate(current.page.id, { html })}
            onSetBg={(color) => applyPageUpdate(current.page.id, { bgColor: color })}
          />
        )}
      </main>

      {/* ---------------- Podcast drawer ---------------- */}
      {podcastOpen && current && (
        <PodcastDrawer
          page={current.page}
          status={podcastStatus}
          script={podcastScript}
          playing={podcastPlaying}
          idx={podcastIdx}
          onToggle={togglePodcastPlay}
          onRetry={() => generatePodcast(current.page, current.page.id)}
          onClose={() => {
            stopPodcast();
            setPodcastOpen(false);
          }}
        />
      )}

      {/* ---------------- Sermon insights drawer ---------------- */}
      {sermonOpen && current && (
        <SermonInsightsDrawer
          page={current.page}
          status={sermonStatus}
          data={sermonData}
          onOpenPage={(id) => {
            setSermonOpen(false);
            openPage(id);
          }}
          onRetry={() => generateSermonInsights(current.page, current.page.id)}
          onClose={() => setSermonOpen(false)}
        />
      )}

      {/* ---------------- Sync modal ---------------- */}
      {syncOpen && (
        <SyncModal
          step={syncStep}
          configured={onenoteConfigured()}
          discovered={discovered}
          error={syncError}
          counts={syncCounts}
          onConnect={runSync}
          onImport={importFromOneNote}
          onClose={closeSync}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Home view                                                                */
/* ---------------------------------------------------------------------- */
function HomeView({ notebooks, recentPages, totalPages, onOpen, onSync }) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-3xl mx-auto px-8 py-14">
        <p style={{ color: C.gold, fontFamily: FONTS.sans, fontSize: 12.5, fontWeight: 700, letterSpacing: "0.08em" }}>
          YOUR LIBRARY
        </p>
        <h1
          style={{
            fontFamily: FONTS.display,
            fontWeight: 600,
            fontSize: 42,
            color: C.ink,
            lineHeight: 1.15,
            marginTop: 8,
          }}
        >
          Your notebooks, read like a book,
          <br />
          heard like a podcast.
        </h1>
        <p style={{ color: C.inkSoft, fontFamily: FONTS.serif, fontSize: 16.5, marginTop: 14, maxWidth: 520 }}>
          {notebooks.length} notebooks and {totalPages} pages, all in one calm, readable place. Pick up a note below, or sync fresh pages in from OneNote.
        </p>

        <div className="flex items-center gap-3 mt-7">
          <button
            onClick={onSync}
            className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium"
            style={{ background: C.ink, color: C.paper, border: "none" }}
          >
            <RefreshCw size={14} /> Sync OneNote
          </button>
          <span className="flex items-center gap-1.5 text-xs" style={{ color: C.inkSoft }}>
            <Headphones size={13} /> Try "Turn into podcast" on any page
          </span>
        </div>

        <h2
          style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 18, color: C.ink, marginTop: 44, marginBottom: 14 }}
        >
          Continue reading
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {recentPages.map((pg) => (
            <button
              key={pg.id}
              onClick={() => onOpen(pg.id)}
              className="text-left p-4 rounded-lg"
              style={{ background: C.cream, border: `1px solid ${C.line}` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: pg.nb.color }} />
                <span style={{ fontSize: 11.5, color: C.inkSoft, fontWeight: 600 }}>
                  {pg.nb.name} · {pg.sec.name}
                </span>
              </div>
              <p style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 15.5, color: C.ink }}>
                {pg.title}
              </p>
              <p style={{ fontSize: 12, color: C.inkSoft, marginTop: 6 }}>Edited {pg.edited}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Reader view                                                             */
/* ---------------------------------------------------------------------- */
function ReaderView({
  current, settings, setSettings, settingsOpen, setSettingsOpen,
  readerBg, readerText, fontFamily, sentences, reading, toggleReadAloud,
  progressPct, onBack, onPodcast, isSermon, onSermonInsights, collapseSidebar,
  onSaveHtml, onSetBg,
}) {
  const { notebook, section, page } = current;
  const [editMode, setEditMode] = useState(false);
  const editorRef = useRef(null);
  const savedRange = useRef(null);

  const pageHtml = page.html || paragraphsToHtml(page.content);
  const effectiveBg = page.bgColor || readerBg;

  useEffect(() => {
    if (editMode && editorRef.current) {
      editorRef.current.innerHTML = pageHtml;
      editorRef.current.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode]);

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current && editorRef.current.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }
  function restoreSelection() {
    if (savedRange.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  }
  function exec(cmd, value = null) {
    document.execCommand(cmd, false, value);
    if (editorRef.current) editorRef.current.focus();
  }
  function applyHighlight(color) {
    restoreSelection();
    let ok = false;
    try {
      ok = document.execCommand("hiliteColor", false, color);
    } catch (e) {
      /* browser doesn't support hiliteColor */
    }
    if (!ok) {
      try {
        document.execCommand("backColor", false, color);
      } catch (e) {
        /* no-op */
      }
    }
    if (editorRef.current) editorRef.current.focus();
  }
  function applyForeColor(color) {
    restoreSelection();
    exec("foreColor", color);
  }
  function saveNow() {
    if (editorRef.current) onSaveHtml(editorRef.current.innerHTML);
    setEditMode(false);
  }
  function handleBlur() {
    if (editorRef.current) onSaveHtml(editorRef.current.innerHTML);
  }

  const paragraphs = page.html ? htmlToParagraphs(page.html) : page.content;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* top bar */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ background: C.paper, borderBottom: `1px solid ${C.line}` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} style={{ background: "none", border: "none" }}>
            <ArrowLeft size={17} color={C.inkSoft} />
          </button>
          <span className="text-xs truncate" style={{ color: C.inkSoft }}>
            {notebook.name} <ChevronRight size={10} style={{ display: "inline", verticalAlign: "middle" }} /> {section.name}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!editMode && (
            <>
              <button
                onClick={toggleReadAloud}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
                style={{
                  background: reading.active ? C.tealDeep : C.cream,
                  color: reading.active ? C.cream : C.ink,
                  border: `1px solid ${C.line}`,
                }}
              >
                {reading.active ? <VolumeX size={13} /> : <Volume2 size={13} />}
                {reading.active ? "Stop" : "Listen"}
              </button>
              <button
                onClick={onPodcast}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
                style={{ background: C.goldDeep, color: C.cream, border: "none" }}
              >
                <Headphones size={13} /> Turn into podcast
              </button>
              {isSermon && (
                <button
                  onClick={onSermonInsights}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
                  style={{ background: C.tealDeep, color: C.cream, border: "none" }}
                >
                  <Sparkles size={13} /> Sermon insights
                </button>
              )}
            </>
          )}
          <button
            onClick={() => (editMode ? saveNow() : setEditMode(true))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
            style={{
              background: editMode ? C.ink : C.cream,
              color: editMode ? C.paper : C.ink,
              border: `1px solid ${C.line}`,
            }}
          >
            {editMode ? <Check size={13} /> : <Pencil size={13} />}
            {editMode ? "Done" : "Edit"}
          </button>
          {!editMode && (
            <button
              onClick={() => setSettingsOpen((s) => !s)}
              className="p-2 rounded-md"
              style={{ background: settingsOpen ? C.cream : "none", border: `1px solid ${settingsOpen ? C.line : "transparent"}` }}
            >
              <Type size={15} color={C.inkSoft} />
            </button>
          )}
        </div>
      </div>

      {/* settings popover */}
      {settingsOpen && !editMode && (
        <div
          className="px-6 py-4 flex items-center gap-6 flex-wrap flex-shrink-0"
          style={{ background: C.paper, borderBottom: `1px solid ${C.line}` }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: C.inkSoft }}>Theme</span>
            {[
              { k: "light", icon: Sun },
              { k: "sepia", icon: Coffee },
              { k: "dark", icon: Moon },
            ].map(({ k, icon: Icon }) => (
              <button
                key={k}
                onClick={() => setSettings((s) => ({ ...s, theme: k }))}
                className="p-1.5 rounded-md"
                style={{
                  background: settings.theme === k ? C.ink : C.cream,
                  border: `1px solid ${C.line}`,
                }}
              >
                <Icon size={13} color={settings.theme === k ? C.paper : C.inkSoft} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: C.inkSoft }}>Type</span>
            {["serif", "sans"].map((f) => (
              <button
                key={f}
                onClick={() => setSettings((s) => ({ ...s, fontFamily: f }))}
                className="px-2.5 py-1 rounded-md text-xs capitalize"
                style={{
                  background: settings.fontFamily === f ? C.ink : C.cream,
                  color: settings.fontFamily === f ? C.paper : C.inkSoft,
                  border: `1px solid ${C.line}`,
                  fontFamily: f === "serif" ? FONTS.serif : FONTS.sans,
                }}
              >
                Aa
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: C.inkSoft }}>Size</span>
            <button
              onClick={() => setSettings((s) => ({ ...s, fontSize: Math.max(15, s.fontSize - 1) }))}
              className="w-6 h-6 rounded-md text-xs" style={{ background: C.cream, border: `1px solid ${C.line}` }}
            >-</button>
            <span className="text-xs w-5 text-center" style={{ color: C.inkSoft }}>{settings.fontSize}</span>
            <button
              onClick={() => setSettings((s) => ({ ...s, fontSize: Math.min(26, s.fontSize + 1) }))}
              className="w-6 h-6 rounded-md text-xs" style={{ background: C.cream, border: `1px solid ${C.line}` }}
            >+</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: C.inkSoft }}>Page color</span>
            {BG_SWATCHES.map((sw) => (
              <button
                key={sw.v}
                onClick={() => onSetBg(sw.v)}
                className="w-5 h-5 rounded-full"
                style={{
                  background: sw.v,
                  border: page.bgColor === sw.v ? `2px solid ${C.ink}` : `1px solid ${C.line}`,
                }}
              />
            ))}
            <button
              onClick={() => onSetBg(null)}
              className="text-xs px-2 py-1 rounded-md"
              style={{ background: C.cream, border: `1px solid ${C.line}`, color: C.inkSoft }}
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* formatting toolbar (edit mode) */}
      {editMode && (
        <div
          className="flex items-center gap-2 px-6 py-3 flex-shrink-0 flex-wrap"
          style={{ background: C.paper, borderBottom: `1px solid ${C.line}` }}
        >
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("bold")}
            className="p-2 rounded-md" style={{ background: C.cream, border: `1px solid ${C.line}` }}
          >
            <Bold size={14} color={C.ink} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("italic")}
            className="p-2 rounded-md" style={{ background: C.cream, border: `1px solid ${C.line}` }}
          >
            <Italic size={14} color={C.ink} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec("underline")}
            className="p-2 rounded-md" style={{ background: C.cream, border: `1px solid ${C.line}` }}
          >
            <Underline size={14} color={C.ink} />
          </button>

          <span style={{ width: 1, height: 22, background: C.line, margin: "0 4px" }} />

          <label
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs"
            style={{ background: C.cream, border: `1px solid ${C.line}`, color: C.inkSoft }}
          >
            <Type size={13} /> Color
            <input
              type="color"
              defaultValue="#25211A"
              onMouseDown={saveSelection}
              onChange={(e) => applyForeColor(e.target.value)}
              style={{ width: 18, height: 18, border: "none", padding: 0, background: "none" }}
            />
          </label>
          <label
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs"
            style={{ background: C.cream, border: `1px solid ${C.line}`, color: C.inkSoft }}
          >
            <Highlighter size={13} /> Highlight
            <input
              type="color"
              defaultValue="#F4D35E"
              onMouseDown={saveSelection}
              onChange={(e) => applyHighlight(e.target.value)}
              style={{ width: 18, height: 18, border: "none", padding: 0, background: "none" }}
            />
          </label>

          <span style={{ width: 1, height: 22, background: C.line, margin: "0 4px" }} />

          <div className="flex items-center gap-1.5">
            <Palette size={13} color={C.inkSoft} />
            <span className="text-xs" style={{ color: C.inkSoft }}>Page background</span>
            {BG_SWATCHES.map((sw) => (
              <button
                key={sw.v}
                onClick={() => onSetBg(sw.v)}
                className="w-5 h-5 rounded-full"
                style={{
                  background: sw.v,
                  border: page.bgColor === sw.v ? `2px solid ${C.ink}` : `1px solid ${C.line}`,
                }}
              />
            ))}
            <button
              onClick={() => onSetBg(null)}
              className="text-xs px-2 py-1 rounded-md"
              style={{ background: C.cream, border: `1px solid ${C.line}`, color: C.inkSoft }}
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* content */}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin"
        style={{ background: effectiveBg }}
        onClick={!editMode ? collapseSidebar : undefined}
      >
        <div className="max-w-2xl mx-auto px-8 py-14">
          <p style={{ color: readerText, opacity: 0.55, fontSize: 12.5, fontFamily: FONTS.sans, fontWeight: 600, letterSpacing: "0.06em" }}>
            {page.edited.toUpperCase()}
          </p>
          <h1
            style={{
              fontFamily: FONTS.display,
              fontWeight: 700,
              fontSize: 34,
              color: readerText,
              marginTop: 8,
              marginBottom: 28,
              lineHeight: 1.2,
            }}
          >
            {page.title}
          </h1>

          {page.scripture && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md mb-7"
              style={{ background: `${C.plum}22`, border: `1px solid ${C.plum}55` }}
            >
              <Quote size={11} color={C.plum} />
              <span style={{ fontSize: 12, fontWeight: 600, color: C.plum }}>{page.scripture}</span>
            </div>
          )}

          {editMode ? (
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onBlur={handleBlur}
              style={{
                fontFamily,
                fontSize: settings.fontSize,
                lineHeight: settings.lineHeight,
                color: readerText,
                minHeight: 200,
                outline: "none",
                padding: 12,
                borderRadius: 8,
                border: `1px dashed ${C.line}`,
              }}
            />
          ) : reading.active ? (
            (() => {
              let flatIdx = -1;
              return paragraphs.map((para, pIdx) => (
                <p
                  key={pIdx}
                  style={{
                    fontFamily,
                    fontSize: settings.fontSize,
                    lineHeight: settings.lineHeight,
                    color: readerText,
                    marginBottom: 22,
                  }}
                >
                  {splitSentences(para).map((s, si) => {
                    flatIdx += 1;
                    const active = reading.idx === flatIdx;
                    return (
                      <span
                        key={si}
                        style={{
                          background: active ? (settings.theme === "dark" ? "#4A4230" : `${C.gold}44`) : "transparent",
                          borderRadius: 3,
                          transition: "background 0.2s",
                        }}
                      >
                        {s}{" "}
                      </span>
                    );
                  })}
                </p>
              ));
            })()
          ) : (
            <div
              style={{ fontFamily, fontSize: settings.fontSize, lineHeight: settings.lineHeight, color: readerText }}
              dangerouslySetInnerHTML={{ __html: pageHtml }}
            />
          )}
        </div>
      </div>

      {/* progress */}
      <div className="px-6 py-2 flex items-center gap-3 flex-shrink-0" style={{ background: C.paper, borderTop: `1px solid ${C.line}` }}>
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: C.line }}>
          <div className="h-full" style={{ width: `${Math.max(progressPct, reading.active ? progressPct : 0)}%`, background: C.gold, transition: "width 0.3s" }} />
        </div>
        <span className="text-xs flex-shrink-0" style={{ color: C.inkSoft }}>
          {reading.active ? `${progressPct}% read aloud` : editMode ? "Editing…" : `${sentences.length} sentences`}
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Podcast drawer                                                          */
/* ---------------------------------------------------------------------- */
function PodcastDrawer({ page, status, script, playing, idx, onToggle, onRetry, onClose }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current && idx >= 0) {
      const el = listRef.current.querySelector(`[data-line="${idx}"]`);
      if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [idx]);

  return (
    <div
      className="fixed right-0 top-0 h-full w-96 flex flex-col z-20"
      style={{ background: C.paper, borderLeft: `1px solid ${C.line}`, boxShadow: "-8px 0 24px rgba(0,0,0,0.08)" }}
    >
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2">
          <Headphones size={16} color={C.goldDeep} />
          <span style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 15, color: C.ink }}>Podcast</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none" }}>
          <X size={16} color={C.inkSoft} />
        </button>
      </div>

      <p className="px-5 pt-3 text-xs" style={{ color: C.inkSoft }}>
        Based on <span style={{ fontWeight: 600, color: C.ink }}>{page.title}</span>
      </p>

      {status === "loading" && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3">
          <Loader2 size={22} color={C.gold} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ color: C.inkSoft, fontSize: 13.5 }}>
            Booking Maya and Leo… briefing them on your note…
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3">
          <p style={{ color: C.inkSoft, fontSize: 13.5 }}>The hosts got stuck. Let's try that again.</p>
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-md text-sm"
            style={{ background: C.ink, color: C.paper, border: "none" }}
          >
            Retry
          </button>
        </div>
      )}

      {status === "ready" && script && (
        <>
          <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-3">
            {script.map((line, i) => {
              const isMaya = line.speaker === "Maya";
              const active = i === idx;
              return (
                <div key={i} data-line={i} className="flex gap-2.5" style={{ opacity: active ? 1 : 0.75 }}>
                  <div
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold"
                    style={{ background: isMaya ? C.teal : C.gold, color: C.cream }}
                  >
                    {line.speaker[0]}
                  </div>
                  <div
                    className="rounded-lg px-3 py-2 text-sm"
                    style={{
                      background: active ? (isMaya ? `${C.teal}22` : `${C.gold}22`) : C.cream,
                      border: `1px solid ${active ? (isMaya ? C.teal : C.goldDeep) : C.line}`,
                      color: C.ink,
                      lineHeight: 1.5,
                    }}
                  >
                    <p className="text-xs font-semibold mb-0.5" style={{ color: isMaya ? C.tealDeep : C.goldDeep }}>
                      {line.speaker}
                    </p>
                    {line.text}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-5 py-4 flex items-center gap-3" style={{ borderTop: `1px solid ${C.line}` }}>
            <button
              onClick={onToggle}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: C.ink, border: "none" }}
            >
              {playing ? <Pause size={16} color={C.paper} /> : <Play size={16} color={C.paper} style={{ marginLeft: 2 }} />}
            </button>
            <div className="flex items-end gap-0.5 h-6">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 3,
                    height: "100%",
                    background: C.gold,
                    borderRadius: 2,
                    display: "inline-block",
                    animation: playing ? `wave ${0.6 + i * 0.1}s ease-in-out infinite` : "none",
                    opacity: playing ? 1 : 0.3,
                  }}
                />
              ))}
            </div>
            <span className="text-xs" style={{ color: C.inkSoft }}>
              {playing ? "Playing…" : idx >= 0 ? "Paused" : "Ready to play"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Sermon insights drawer                                                  */
/* ---------------------------------------------------------------------- */
function SermonInsightsDrawer({ page, status, data, onOpenPage, onRetry, onClose }) {
  return (
    <div
      className="fixed right-0 top-0 h-full w-96 flex flex-col z-20"
      style={{ background: C.paper, borderLeft: `1px solid ${C.line}`, boxShadow: "-8px 0 24px rgba(0,0,0,0.08)" }}
    >
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2">
          <Sparkles size={16} color={C.tealDeep} />
          <span style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 15, color: C.ink }}>
            Sermon insights
          </span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none" }}>
          <X size={16} color={C.inkSoft} />
        </button>
      </div>

      <p className="px-5 pt-3 text-xs" style={{ color: C.inkSoft }}>
        Scanning your sermon archive against <span style={{ fontWeight: 600, color: C.ink }}>{page.title}</span>
      </p>

      {status === "loading" && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3">
          <Loader2 size={22} color={C.teal} style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ color: C.inkSoft, fontSize: 13.5 }}>
            Reading through past sermons for connections and repeats…
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-3">
          <p style={{ color: C.inkSoft, fontSize: 13.5 }}>Couldn't finish that pass. Let's try again.</p>
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-md text-sm"
            style={{ background: C.ink, color: C.paper, border: "none" }}
          >
            Retry
          </button>
        </div>
      )}

      {status === "ready" && data && (
        <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-6">
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: C.tealDeep, letterSpacing: "0.04em" }}>
              RELATED SERMONS
            </p>
            {data.related && data.related.length ? (
              <div className="space-y-2">
                {data.related.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => onOpenPage(r.id)}
                    className="w-full text-left p-3 rounded-lg"
                    style={{ background: C.cream, border: `1px solid ${C.line}` }}
                  >
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>
                      {r.page ? r.page.title : r.id}
                    </p>
                    {r.page && (
                      <p style={{ fontSize: 11.5, color: C.plum, marginTop: 2 }}>{r.page.scripture}</p>
                    )}
                    <p style={{ fontSize: 12, color: C.inkSoft, marginTop: 4, lineHeight: 1.4 }}>{r.reason}</p>
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12.5, color: C.inkSoft }}>No close matches in the archive yet.</p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: C.goldDeep, letterSpacing: "0.04em" }}>
              FRESH ILLUSTRATION IDEAS
            </p>
            {data.illustrationIdeas && data.illustrationIdeas.length ? (
              <ul className="space-y-2">
                {data.illustrationIdeas.map((idea, i) => (
                  <li
                    key={i}
                    className="p-3 rounded-lg text-sm"
                    style={{ background: `${C.gold}18`, border: `1px solid ${C.gold}55`, color: C.ink, lineHeight: 1.45 }}
                  >
                    {idea}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 12.5, color: C.inkSoft }}>Nothing new suggested this pass.</p>
            )}
          </div>

          {data.repeatedIllustrations && data.repeatedIllustrations.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: C.rust, letterSpacing: "0.04em" }}>
                <AlertTriangle size={12} /> HEADS UP — REPEATED
              </p>
              <ul className="space-y-2">
                {data.repeatedIllustrations.map((w, i) => (
                  <li
                    key={i}
                    className="p-3 rounded-lg text-sm"
                    style={{ background: `${C.rust}15`, border: `1px solid ${C.rust}55`, color: C.ink, lineHeight: 1.45 }}
                  >
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: C.inkSoft, letterSpacing: "0.04em" }}>
              CROSS-REFERENCES TO CONSIDER
            </p>
            {data.crossReferences && data.crossReferences.length ? (
              <ul className="space-y-1.5">
                {data.crossReferences.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-sm" style={{ color: C.ink }}>
                    <Quote size={12} color={C.plum} style={{ marginTop: 3, flexShrink: 0 }} />
                    {c}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 12.5, color: C.inkSoft }}>None suggested this pass.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Sync modal                                                              */
/* ---------------------------------------------------------------------- */
function SyncModal({ step, configured, discovered = [], error, counts, onConnect, onImport, onClose }) {
  const totalSections = discovered.reduce((s, nb) => s + nb.sections.length, 0);
  const totalPages = discovered.reduce(
    (s, nb) => s + nb.sections.reduce((p, sec) => p + sec.pages.length, 0),
    0
  );
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-30 px-4"
      style={{ background: "rgba(37,33,26,0.45)" }}
    >
      <div
        className="w-full max-w-md rounded-xl overflow-hidden"
        style={{ background: C.cream, border: `1px solid ${C.line}` }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-2">
            <Link2 size={15} color={C.goldDeep} />
            <span style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 15, color: C.ink }}>
              Sync with OneNote
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none" }}>
            <X size={16} color={C.inkSoft} />
          </button>
        </div>

        <div className="px-6 py-6">
          {step === "intro" && (
            <>
              <p style={{ color: C.inkSoft, fontSize: 14, lineHeight: 1.6 }}>
                Marginalia connects to your real OneNote account through Microsoft Graph and pulls
                your notebooks, sections, and pages in — formatting preserved.
              </p>
              {configured ? (
                <>
                  <button
                    onClick={onConnect}
                    className="w-full flex items-center justify-center gap-2 mt-5 py-2.5 rounded-md text-sm font-medium"
                    style={{ background: C.ink, color: C.paper, border: "none" }}
                  >
                    <Link2 size={14} /> Connect Microsoft account
                  </button>
                  <p className="text-xs mt-4" style={{ color: C.inkSoft, opacity: 0.75, lineHeight: 1.5 }}>
                    You'll sign in with Microsoft in a popup. Marginalia only requests read access
                    to your notes (Notes.Read).
                  </p>
                </>
              ) : (
                <div
                  className="mt-5 p-3 rounded-lg"
                  style={{ border: `1px solid ${C.line}`, background: C.paper }}
                >
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 4 }}>
                    OneNote sync isn't configured yet
                  </p>
                  <p style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5 }}>
                    Add your Azure app's client ID as <code>VITE_MS_CLIENT_ID</code> in the project's
                    environment variables, then redeploy to enable real sign-in.
                  </p>
                </div>
              )}
            </>
          )}

          {step === "connecting" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 size={22} color={C.gold} style={{ animation: "spin 1s linear infinite" }} />
              <p style={{ color: C.inkSoft, fontSize: 14 }}>Connecting to OneNote and reading your notebooks…</p>
            </div>
          )}

          {step === "found" && (
            <>
              <p style={{ color: C.ink, fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
                Found {discovered.length} notebook{discovered.length === 1 ? "" : "s"} · {totalSections} section
                {totalSections === 1 ? "" : "s"} · {totalPages} page{totalPages === 1 ? "" : "s"}
              </p>
              <div className="flex flex-col gap-2 max-h-56 overflow-auto">
                {discovered.map((nb) => {
                  const secs = nb.sections.length;
                  const pgs = nb.sections.reduce((p, sec) => p + sec.pages.length, 0);
                  return (
                    <div
                      key={nb.id}
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{ border: `1px solid ${C.line}`, background: C.paper }}
                    >
                      <span className="w-2.5 h-8 rounded-sm" style={{ background: nb.color }} />
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{nb.name}</p>
                        <p style={{ fontSize: 12, color: C.inkSoft }}>
                          {secs} section{secs === 1 ? "" : "s"} · {pgs} page{pgs === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Check size={16} color={C.teal} style={{ marginLeft: "auto" }} />
                    </div>
                  );
                })}
              </div>
              <button
                onClick={onImport}
                className="w-full flex items-center justify-center gap-2 mt-5 py-2.5 rounded-md text-sm font-medium"
                style={{ background: C.goldDeep, color: C.cream, border: "none" }}
              >
                Import into Marginalia
              </button>
            </>
          )}

          {step === "importing" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 size={22} color={C.gold} style={{ animation: "spin 1s linear infinite" }} />
              <p style={{ color: C.inkSoft, fontSize: 14 }}>Importing pages and preserving formatting…</p>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: `${C.gold}22` }}>
                <X size={22} color={C.goldDeep} />
              </div>
              <p style={{ fontSize: 14.5, fontWeight: 600, color: C.ink }}>Couldn't sync OneNote</p>
              <p style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.5 }}>{error}</p>
              <button
                onClick={onConnect}
                className="mt-2 px-5 py-2 rounded-md text-sm font-medium"
                style={{ background: C.ink, color: C.paper, border: "none" }}
              >
                Try again
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: `${C.teal}22` }}>
                <CheckCircle2 size={22} color={C.tealDeep} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>
                Imported {counts.notebooks} notebook{counts.notebooks === 1 ? "" : "s"}, {counts.sections} section
                {counts.sections === 1 ? "" : "s"}, {counts.pages} page{counts.pages === 1 ? "" : "s"}
              </p>
              <p style={{ fontSize: 13, color: C.inkSoft }}>Find your notebooks in the sidebar.</p>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 rounded-md text-sm font-medium"
                style={{ background: C.ink, color: C.paper, border: "none" }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
