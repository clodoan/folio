import type { LedgerEvent } from "./schema";
import { splitActivitySlices } from "./activity";

export type LetterStanza = {
  topic: string;
  aside: string;
  beat: string;
};

export type FolioLetter = {
  day: string;
  name: string;
  initials: string;
  opening: string;
  stanzas: LetterStanza[];
  close: string;
  signatures: string[];
  silent: boolean;
};

const LEAD_VERBS =
  /^(scaffold|add|confirm|make|fix|update|build|write|turn|sync|create|implement|continue|check|run|open|ship|install|refactor|move|copy|remove|delete|set|get|use|try|please|help|need|want|put|bring|start|stop|keep)\b/i;

const NOUNS: { re: RegExp; noun: string }[] = [
  { re: /\bjournal\b/i, noun: "the journal" },
  { re: /\bletter\b/i, noun: "the letter" },
  { re: /\bexport\b/i, noun: "export" },
  { re: /\btimeline\b/i, noun: "the timeline" },
  { re: /\bingest\b/i, noun: "ingest" },
  { re: /\bwatch\b/i, noun: "the watch" },
  { re: /\bconfig\b/i, noun: "config" },
  { re: /\bkit\b/i, noun: "the kit" },
  { re: /\bpdf\b/i, noun: "the page" },
  { re: /\bpage\b/i, noun: "the page" },
  { re: /\blayout\b/i, noun: "layout" },
  { re: /\bpath\b/i, noun: "the path" },
  { re: /\bscript\b/i, noun: "scripts" },
  { re: /\bbuild\b/i, noun: "the build" },
  { re: /\btypecheck\b/i, noun: "types" },
  { re: /\btranscript\b/i, noun: "transcripts" },
  { re: /\bsummary\b/i, noun: "the summary" },
  { re: /\bdesktop\b/i, noun: "the desk" },
];

const BANNED = /\b(great|exciting|happy to)\b/gi;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

function stripUserChrome(text: string): string {
  return text
    .replace(/<timestamp>[\s\S]*?<\/timestamp>/gi, " ")
    .replace(/<\/?user_query>/gi, " ")
    .replace(/<user_info>[\s\S]*?<\/user_info>/gi, " ")
    .replace(/<[\s\S]*?>/g, " ")
    .replace(EMOJI, " ")
    .replace(BANNED, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function quotedPhrase(text: string): string | undefined {
  const m = text.match(/[“"]([^”"]{3,80})[”"]/) || text.match(/'([^']{3,80})'/);
  if (!m) return undefined;
  return m[1].trim();
}

function userText(ev: LedgerEvent | undefined): string {
  if (!ev) return "";
  if (typeof ev.payload === "object" && ev.payload && "text" in ev.payload) {
    const t = (ev.payload as { text?: unknown }).text;
    if (typeof t === "string" && t.trim()) return t;
  }
  return ev.summary ?? "";
}

export function ordinaryNoun(text: string): string {
  let t = stripUserChrome(text);
  if (!t) return "";
  const quoted = quotedPhrase(t);
  if (quoted) {
    const q = quoted.split(/\s+/).slice(0, 4).join(" ");
    if (q) return soften(q);
  }
  t = (t.split(/[.!?]/)[0] ?? t).trim();
  for (const n of NOUNS) {
    if (n.re.test(t)) return n.noun;
  }
  t = t.replace(LEAD_VERBS, "").trim();
  t = t.replace(/^(a|an|the)\s+/i, (m) => m.toLowerCase());
  const words = t.split(/\s+/).filter(Boolean).slice(0, 4);
  return soften(words.join(" "));
}

function soften(s: string): string {
  return s.replace(/\s+/g, " ").replace(/[.,;:!?]+$/g, "").trim();
}

function firstSentence(text: string, max = 110): string {
  let t = stripUserChrome(text);
  t = (t.split(/[.!?]/)[0] ?? t).trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > 40 ? cut.slice(0, sp) : cut).trim();
}

function hourInTz(iso: string, timeZone: string): number {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(new Date(iso));
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n)) return 12;
  return n === 24 ? 0 : n;
}

export function pencilAside(iso: string, timeZone: string): string {
  const hour = hourInTz(iso, timeZone);
  if (hour < 12) return "late morning";
  if (hour < 14) return "just after lunch";
  if (hour < 16) return "mid-afternoon";
  if (hour < 18) return "late afternoon";
  return "evening";
}

function joinOn(topics: string[]): string {
  if (topics.length === 1) return topics[0];
  if (topics.length === 2) return `${topics[0]} and ${topics[1]}`;
  const last = topics[topics.length - 1];
  return `${topics.slice(0, -1).join(", ")}, and ${last}`;
}

function sentenceCaseLine(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return t;
  const noYell = t.replace(/\b[A-Z]{2,}\b/g, (m) => m.charAt(0) + m.slice(1).toLowerCase());
  return noYell.charAt(0).toUpperCase() + noYell.slice(1);
}

export function handInitials(name: string): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    const a = (parts[0][0] || "C").toUpperCase();
    const b = (parts[1][0] || "a").toLowerCase();
    return `${a}${b}`;
  }
  const token = (parts[0] || "Ca").replace(/[^A-Za-z]/g, "");
  const a = (token[0] || "C").toUpperCase();
  const vowel = token.slice(1).match(/[aeiou]/i);
  const b = (vowel ? vowel[0] : token[1] || "a").toLowerCase();
  return `${a}${b}`;
}

export function personName(name: string): string {
  const n = String(name || "").replace(/\s+/g, " ").trim();
  if (!n || /^[A-Za-z]{1,2}$/.test(n)) return "you";
  return n;
}

export function stanzaLines(letter: FolioLetter): string[] {
  return letter.stanzas.map((s) => {
    const topic = sentenceCaseLine(s.topic);
    const beat = sentenceCaseLine(s.beat);
    if (beat && beat.toLowerCase() !== topic.toLowerCase()) {
      return beat.endsWith(".") ? beat : `${beat}.`;
    }
    return topic.endsWith(".") ? topic : `${topic}.`;
  });
}

export function agentFirstName(agent: string): string {
  const cleaned = agent.trim();
  if (!cleaned) return "";
  const token = cleaned.split(/[\s/_]+/)[0] ?? cleaned;
  const head = (token.split("-")[0] ?? token).trim();
  if (!head) return "";
  return head.charAt(0).toUpperCase() + head.slice(1).toLowerCase();
}

function looksLikeSessionId(topic: string): boolean {
  return /^sess(ion)?[_\s-]/i.test(topic) || /^session\s/i.test(topic);
}

export function composeLetter(
  day: string,
  events: LedgerEvent[],
  opts: { name: string; timezone: string },
): FolioLetter {
  const slices = splitActivitySlices(events);
  const seen = new Set<string>();
  const topics: { topic: string; aside: string; beat: string; sessionId: string }[] = [];

  for (const slice of slices) {
    const sess = events.filter((e) => e.sessionId === slice.sessionId);
    const user = sess.find((e) => e.kind === "message" && e.role === "user");
    const raw = userText(user);
    let topic = ordinaryNoun(raw).replace(/\b[A-Z]{2,}\b/g, (m) => m.charAt(0) + m.slice(1).toLowerCase());
    if (!topic || looksLikeSessionId(topic) || topic.startsWith("is ") || topic.startsWith("are ") || topic.startsWith("what ") || topic.startsWith("how ")) continue;
    const key = topic.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const iso = new Date(slice.startMs).toISOString();
    topics.push({
      topic,
      aside: pencilAside(iso, opts.timezone),
      beat: firstSentence(raw || slice.topic),
      sessionId: slice.sessionId,
    });
  }

  const stanzas = topics.slice(0, 4).map(({ topic, aside, beat }) => ({ topic, aside, beat }));
  const silent = stanzas.length === 0;
  const name = personName(opts.name);
  const initials = handInitials(name);
  const opening = silent
    ? ""
    : `Today we worked with ${name} on ${joinOn(stanzas.map((s) => s.topic))}.`;

  const names: string[] = [];
  const nameSet = new Set<string>();
  const sorted = [...events].sort((a, b) => a.ts.localeCompare(b.ts) || a.id.localeCompare(b.id));
  for (const e of sorted) {
    const n = agentFirstName(e.agent);
    if (!n) continue;
    const k = n.toLowerCase();
    if (nameSet.has(k)) continue;
    nameSet.add(k);
    names.push(n);
  }

  return {
    day,
    name,
    initials,
    opening,
    stanzas,
    close: silent ? "" : "We set the work down.",
    signatures: names,
    silent,
  };
}
