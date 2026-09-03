import assert from "node:assert/strict";
import { test } from "node:test";
import { grokTranscriptToEvents, looksLikeGrokRecord, tsToIso } from "../src/adapters/grokTui.ts";
import { formatHintForPath, inferProviderFromPath, sessionIdFromPath } from "../src/agents.ts";
import { parseIngestText } from "../src/ingestParse.ts";
import { resolveWatchSpecs } from "./watchTargets.ts";

test("tsToIso treats grok update timestamps as seconds", () => {
  assert.equal(tsToIso(1788462961, ""), "2026-09-03T19:16:01.000Z");
});

test("infer provider from well-known homes, not a default IDE", () => {
  assert.equal(
    inferProviderFromPath("/Users/ada/.grok/sessions/%2Ftmp/01a068b2-e713-73f0-a6d7-a6fc061fc53f/updates.jsonl"),
    "grok",
  );
  assert.equal(
    sessionIdFromPath("/Users/ada/.grok/sessions/%2Ftmp/01a068b2-e713-73f0-a6d7-a6fc061fc53f/updates.jsonl"),
    "01a068b2-e713-73f0-a6d7-a6fc061fc53f",
  );
  assert.equal(inferProviderFromPath("/Users/ada/.claude/projects/-tmp/sess.jsonl"), "claude");
  assert.equal(inferProviderFromPath("/Users/ada/.codex/sessions/abc.jsonl"), "codex");
  assert.equal(inferProviderFromPath("/Users/ada/.amp/sessions/abc.jsonl"), "amp");
  assert.equal(inferProviderFromPath("/tmp/drop.jsonl"), "local");
});

test("watch specs include whichever agents exist on this machine", () => {
  const specs = resolveWatchSpecs();
  const labels = specs.map((s) => s.label);
  assert.equal(labels.includes("inbox"), true);
  const providers = new Set(specs.map((s) => s.provider).filter(Boolean));
  assert.equal(providers.has("cursor") || providers.has("grok") || providers.has("claude"), true);
});

test("format hint follows the agent, not the host app", () => {
  assert.equal(formatHintForPath("/Users/ada/.grok/sessions/s/chat_history.jsonl"), "grok");
  assert.equal(formatHintForPath("/Users/ada/.claude/projects/p/s.jsonl"), "transcript");
  assert.equal(formatHintForPath("/Users/ada/.cursor/projects/p/agent-transcripts/s.jsonl"), "transcript");
  assert.equal(formatHintForPath("/Users/ada/.codex/sessions/s.jsonl"), "auto");
});

test("parse grok ACP updates into messages and tools", () => {
  const text = [
    JSON.stringify({
      timestamp: 1788462961,
      method: "session/update",
      params: {
        sessionId: "sess-1",
        update: {
          sessionUpdate: "user_message_chunk",
          content: { type: "text", text: "run " },
        },
      },
    }),
    JSON.stringify({
      timestamp: 1788462962,
      method: "session/update",
      params: {
        sessionId: "sess-1",
        update: {
          sessionUpdate: "user_message_chunk",
          content: { type: "text", text: "dune" },
        },
      },
    }),
    JSON.stringify({
      timestamp: 1788462963,
      method: "session/update",
      params: {
        sessionId: "sess-1",
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text: "Starting Dune." },
        },
      },
    }),
    JSON.stringify({
      timestamp: 1788462964,
      method: "session/update",
      params: {
        sessionId: "sess-1",
        update: {
          sessionUpdate: "tool_call",
          toolCallId: "call-1",
          title: "read_file",
          rawInput: { target_file: "package.json" },
        },
      },
    }),
    JSON.stringify({
      timestamp: 1788462965,
      method: "session/update",
      params: {
        sessionId: "sess-1",
        update: { sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "hmm" } },
      },
    }),
  ].join("\n");

  assert.equal(looksLikeGrokRecord(JSON.parse(text.split("\n")[0] ?? "{}")), true);
  const events = grokTranscriptToEvents(text, { provider: "grok", agent: "grok" });
  assert.equal(events.length, 3);
  assert.equal(events[0]?.role, "user");
  assert.equal(events[0]?.summary, "run dune");
  assert.equal(events[0]?.provider, "grok");
  assert.equal(events[0]?.sessionId, "sess-1");
  assert.equal(events[1]?.role, "agent");
  assert.equal(events[2]?.kind, "tool");
  assert.match(events[2]?.summary ?? "", /read_file/);
});

test("grok format keeps chat_history on session timestamps", () => {
  const text = JSON.stringify({ type: "user", content: "hello from tui" });
  const parsed = parseIngestText(text, {
    format: "grok",
    defaults: {
      provider: "grok",
      sessionId: "s1",
      fallbackStartIso: "2026-08-04T19:00:00.000Z",
    },
  });
  assert.equal(parsed.mode, "grok");
  assert.equal(parsed.events[0]?.ts.startsWith("2026-08-04"), true);
  assert.equal(parsed.events[0]?.provider, "grok");
});

test("parseIngestText routes grok updates by content", () => {
  const line = JSON.stringify({
    timestamp: 1788462961,
    method: "session/update",
    params: {
      sessionId: "s",
      update: { sessionUpdate: "user_message_chunk", content: { type: "text", text: "hi" } },
    },
  });
  const parsed = parseIngestText(line);
  assert.equal(parsed.mode, "grok");
  assert.equal(parsed.events[0]?.provider, "grok");
});

test("chat_history uses sibling fallback timestamps instead of now", () => {
  const text = [
    JSON.stringify({ type: "system", content: "You are Grok" }),
    JSON.stringify({ type: "user", content: [{ type: "text", text: "fix the letter" }] }),
    JSON.stringify({ type: "assistant", content: "On it." }),
  ].join("\n");
  const events = grokTranscriptToEvents(text, {
    provider: "grok",
    sessionId: "old-sess",
    fallbackStartIso: "2026-08-04T19:04:40.144Z",
    fallbackEndIso: "2026-08-05T04:56:53.509Z",
  });
  assert.equal(events.some((e) => e.role === "user" && e.summary === "fix the letter"), true);
  assert.equal(events[0]?.ts.startsWith("2026-08-04"), true);
  assert.equal(events.some((e) => e.ts.startsWith("2026-08-05") && e.summary === "session ended"), true);
});

test("summary.json becomes a titled session span", () => {
  const text = JSON.stringify({
    grok_home: "/Users/ada/.grok",
    generated_title: "Run desktop-app dune locally",
    created_at: "2026-09-03T19:15:50.207Z",
    last_active_at: "2026-09-03T19:16:29.157Z",
    current_model_id: "grok-4.6-fast",
    session_summary: "Run desktop-app dune locally",
  });
  const events = grokTranscriptToEvents(text, { sessionId: "sum-1" });
  assert.equal(events.length, 2);
  assert.equal(events[0]?.role, "user");
  assert.equal(events[0]?.summary, "Run desktop-app dune locally");
  assert.equal(events[1]?.summary, "session ended");
});
