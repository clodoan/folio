import type { LedgerEvent } from "./schema";
import { payloadText } from "./schema";

export type LetterStanza = {
  topic: string;
  lines: string[];
};

export type FolioLetter = {
  day: string;
  name: string;
  initials: string;
  opening: string;
  stanzas: LetterStanza[];
  close: string;
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

// Machine noise that must never surface in a poem: wire ids, hashes,
// URLs, and scheduler chrome. A product name near a URL survives; the
// URL itself does not.
const SYSTEM_REMINDER_BLOCK = /<system[-_ ]?reminder>[\s\S]*?<\/system[-_ ]?reminder>/gi;
const URLISH = /\bhttps?:\/\/\S+|\b(?:www\.)?github\.com\/\S+/gi;
// call-…, bc-…, sand-subagent-…, tool_call/toolCall ids. The digit
// lookahead keeps ordinary hyphenations like "call-out" intact.
const PREFIXED_ID = /\b(?:call|bc|sand-subagent|tool[_-]?call|toolcall|toolu)[-_](?=[\w-]*\d)[\w-]+/gi;
const UUIDISH = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// Hex runs need both a digit and a letter so years and short words survive.
const HEXISH = /\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,}\b/gi;
const OPAQUE_TOKEN = /\b(?=[\w+/=-]*\d)[A-Za-z0-9+/=_-]{25,}\b/g;
const CRONISH = /\(?\bevery(?:\s+\d+)?\s+(?:seconds?|minutes?|mins?|hours?|days?|weeks?|months?)\b\s*\)?/gi;
const ROUTINE_PATH = /\S*[\\/](?:routines?|\.cursor)[\\/]\S*/gi;
const SLASH_COMMAND = /(?:^|\s)\/[a-z][\w-]*(?=\s|$)/gi;

// Texts that are machine chrome end to end: scheduler dumps and agent
// prompt profiles. These never seed a topic, whatever else they mention.
const MACHINE_CHROME = /^(?:scheduled task\b|you are (?:the|a|an)\b|system[-_ ]?reminder\b)/i;

const stripUserChrome = (text: string): string =>
  text
    .replace(/<timestamp>[\s\S]*?<\/timestamp>/gi, " ")
    .replace(SYSTEM_REMINDER_BLOCK, " ")
    .replace(/<\/?user_query>/gi, " ")
    .replace(/<user_info>[\s\S]*?<\/user_info>/gi, " ")
    .replace(/<[\s\S]*?>/g, " ")
    .replace(URLISH, " ")
    .replace(PREFIXED_ID, " ")
    .replace(UUIDISH, " ")
    .replace(HEXISH, " ")
    .replace(OPAQUE_TOKEN, " ")
    .replace(CRONISH, " ")
    .replace(ROUTINE_PATH, " ")
    .replace(SLASH_COMMAND, " ")
    .replace(EMOJI, " ")
    .replace(BANNED, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasHumanWord = (s: string): boolean => /[a-z]{3,}/i.test(s);

const quotedPhrase = (text: string): string | undefined => {
  const m = text.match(/[“"]([^”"]{3,80})[”"]/) || text.match(/'([^']{3,80})'/);
  if (!m) return undefined;
  return m[1].trim();
};

const userText = (ev: LedgerEvent | undefined): string => {
  if (!ev) return "";
  const fromPayload = payloadText(ev.payload).trim();
  if (fromPayload) return fromPayload;
  return ev.summary ?? "";
};

// Dropping a URL or id can leave a line hanging on its preposition or
// stranded inside brackets; the hand writes words, not typography.
const soften = (s: string): string =>
  s
    .replace(/[()[\]{}<>|:;"]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[.,;:!?]+$/g, "")
    .trim()
    .replace(/\s+(?:at|in|on|to|from|via|see|and|or|but)$/i, "");

export const ordinaryNoun = (text: string): string => {
  let t = stripUserChrome(text);
  if (!t || MACHINE_CHROME.test(t)) return "";
  // A quote can carry chrome too: prose about a "Scheduled task" must
  // not put the schedule back on the page.
  const quoted = quotedPhrase(t);
  if (quoted) {
    const q = quoted.split(/\s+/).slice(0, 4).join(" ");
    if (q && hasHumanWord(q) && !MACHINE_CHROME.test(q)) return soften(q);
  }
  t = (t.split(/[.!?]/)[0] ?? t).trim();
  for (const n of NOUNS) {
    if (n.re.test(t)) return n.noun;
  }
  t = t.replace(LEAD_VERBS, "").trim();
  t = t.replace(/^(a|an|the)\s+/i, (m) => m.toLowerCase());
  const words = t.split(/\s+/).filter(Boolean).slice(0, 4);
  const out = soften(words.join(" "));
  return hasHumanWord(out) ? out : "";
};

const firstSentence = (text: string, max = 110): string => {
  let t = stripUserChrome(text);
  t = (t.split(/[.!?]/)[0] ?? t).trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > 40 ? cut.slice(0, sp) : cut).trim();
};

// One poem line. Short enough for the A5 measure.
export const BREATH_MAX = 56;

const clipAtWord = (t: string, max: number): string => {
  const s = soften(t);
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return soften(sp > 12 ? cut.slice(0, sp) : cut);
};

// Split one sentence into one or two breath lines at a natural pause.
export const breathLines = (sentence: string, max = BREATH_MAX): string[] => {
  const t = soften(sentence);
  if (!t) return [];
  if (t.length <= max) return [t];
  const pauses = [...t.matchAll(/,\s+|;\s+|\s+(?=(?:and|then|so|but|while|to|into|with|for)\s)/g)];
  const mid = t.length / 2;
  let best: { left: number; right: number } | undefined;
  for (const m of pauses) {
    const at = m.index ?? 0;
    if (at < 10 || t.length - (at + m[0].length) < 6) continue;
    if (!best || Math.abs(at - mid) < Math.abs(best.left - mid)) {
      best = { left: at + (m[0].startsWith(",") || m[0].startsWith(";") ? 1 : 0), right: at + m[0].length };
    }
  }
  if (best) {
    const left = clipAtWord(t.slice(0, best.left), max);
    const right = clipAtWord(t.slice(best.right), max);
    return right ? [`${left},`, right] : [left];
  }
  const first = clipAtWord(t, max);
  const rest = t.slice(first.length).trim();
  return rest ? [first, clipAtWord(rest, max)] : [first];
};

const joinOn = (topics: string[]): string => {
  if (topics.length === 1) return topics[0];
  if (topics.length === 2) return `${topics[0]} and ${topics[1]}`;
  const last = topics[topics.length - 1];
  return `${topics.slice(0, -1).join(", ")}, and ${last}`;
};

export const handInitials = (name: string): string => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    const a = (parts[0][0] || "A").toUpperCase();
    const b = (parts[1][0] || "a").toLowerCase();
    return `${a}${b}`;
  }
  const token = (parts[0] || "Aa").replace(/[^A-Za-z]/g, "");
  const a = (token[0] || "A").toUpperCase();
  const vowel = token.slice(1).match(/[aeiou]/i);
  const b = (vowel ? vowel[0] : token[1] || "a").toLowerCase();
  return `${a}${b}`;
};

export const personName = (name: string): string => {
  const n = String(name || "").replace(/\s+/g, " ").trim();
  if (!n || /^[A-Za-z]{1,2}$/.test(n)) return "you";
  return n;
};

// Poem lines stay lowercase. The hand writes few capitals, and a
// lowercase line never loses its first letter to a missing glyph.
export const stanzaLines = (letter: FolioLetter): string[] =>
  letter.stanzas.flatMap((s) =>
    s.lines.map((line, i) => {
      const isLast = i === s.lines.length - 1;
      const t = line.replace(/\s+/g, " ").trim().toLowerCase();
      if (!isLast) return t;
      return /[.,]$/.test(t) ? t.replace(/,+$/, ".") : `${t}.`;
    }),
  );

const looksLikeSessionId = (topic: string): boolean =>
  /^sess(ion)?[_\s-]/i.test(topic) || /^session\s/i.test(topic);

const sessionsInOrder = (events: LedgerEvent[]): LedgerEvent[][] => {
  const order: string[] = [];
  const bySession = new Map<string, LedgerEvent[]>();
  const sorted = [...events].sort((a, b) => a.ts.localeCompare(b.ts) || a.id.localeCompare(b.id));
  for (const e of sorted) {
    if (!bySession.has(e.sessionId)) {
      bySession.set(e.sessionId, []);
      order.push(e.sessionId);
    }
    bySession.get(e.sessionId)!.push(e);
  }
  return order.map((id) => bySession.get(id) ?? []);
};

// A non-silent day reads as one poem. These bound its length so the
// hand still fits one A5 page.
export const MAX_STANZAS = 6;
export const MAX_POEM_LINES = 10;

export const composeLetter = (
  day: string,
  events: LedgerEvent[],
  opts: { name: string },
): FolioLetter => {
  const seen = new Set<string>();
  const stanzas: LetterStanza[] = [];
  let poemLines = 0;

  for (const sess of sessionsInOrder(events)) {
    const user = sess.find((e) => e.kind === "message" && e.role === "user");
    const raw = userText(user);
    let topic = ordinaryNoun(raw).replace(/\b[A-Z]{2,}\b/g, (m) => m.charAt(0) + m.slice(1).toLowerCase());
    if (!topic || looksLikeSessionId(topic) || topic.startsWith("is ") || topic.startsWith("are ") || topic.startsWith("what ") || topic.startsWith("how ")) {
      continue;
    }
    const key = topic.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const beat = firstSentence(raw, 130);
    const source = beat && beat.toLowerCase() !== topic.toLowerCase() ? beat : topic;
    const lines = breathLines(source);
    if (!lines.length) continue;
    stanzas.push({ topic, lines });
    poemLines += lines.length;
    if (stanzas.length >= MAX_STANZAS || poemLines >= MAX_POEM_LINES) break;
  }

  const silent = stanzas.length === 0;
  const name = personName(opts.name);
  return {
    day,
    name,
    initials: handInitials(name),
    opening: silent ? "" : `Today we worked with ${name} on ${joinOn(stanzas.map((s) => s.topic))}.`,
    stanzas,
    close: silent ? "" : "We set the work down.",
    silent,
  };
};
