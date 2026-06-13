#!/usr/bin/env node
// Bonfolit hard-rule guardrails (PreToolUse on Write|Edit|MultiEdit).
//   Rule 1 — engine-free layers (Controller/, Model/) must not reference UnityEngine.
//   Rule 8 — game-logic time comes from TimeModel.Now, never DateTime.Now.
// Reads the hook payload as JSON on stdin and emits a PreToolUse decision on stdout.
// Fails OPEN (allows the tool) on any parse/IO error so the hook can never wedge a session.

import { readFileSync } from 'node:fs';

function allow() { process.exit(0); }

function decide(decision, message) {
  // PreToolUse structured output: permissionDecision is "deny" | "ask" | "allow".
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
    },
    systemMessage: message,
  }));
  process.exit(0);
}

let raw = '';
try { raw = readFileSync(0, 'utf8'); } catch { allow(); }

let input;
try { input = JSON.parse(raw || '{}'); } catch { allow(); }

const ti = input.tool_input || {};
const filePath = String(ti.file_path || ti.path || '').replace(/\\/g, '/');

// Only inspect C# source.
if (!/\.cs$/i.test(filePath)) allow();

// Collect the text this tool will introduce into the file.
let text = '';
if (typeof ti.content === 'string') text += ti.content;                  // Write
if (typeof ti.new_string === 'string') text += '\n' + ti.new_string;     // Edit
if (Array.isArray(ti.edits)) {                                           // MultiEdit
  for (const e of ti.edits) {
    if (e && typeof e.new_string === 'string') text += '\n' + e.new_string;
  }
}
if (!text) allow();

// --- Rule 1: engine-free layers ---
if (/\/(Controller|Model)\//.test(filePath)) {
  const engineHit =
    /\busing\s+UnityEngine\b/.test(text) ||
    /:\s*MonoBehaviour\b/.test(text) ||
    /:\s*ScriptableObject\b/.test(text);
  if (engineHit) {
    decide('deny',
      `Bonfolit hard rule #1: ${filePath} lives in an engine-free layer ` +
      `(Controller/ or Model/, assembly noEngineReferences:true), but this change references ` +
      `UnityEngine / MonoBehaviour / ScriptableObject. Put engine code in a View or Service and ` +
      `reach it through an interface. See the bonfolit-standards docs 01 (architecture) and 04 (controllers).`);
  }
}

// --- Rule 8: unbiased time ---
if (/\bDateTime\s*\.\s*(Now|UtcNow|Today)\b/.test(text)) {
  decide('ask',
    `Bonfolit hard rule #8: game-logic time must come from TimeModel.Now (unbiased) so countdowns ` +
    `survive device-clock tampering — not DateTime.Now/UtcNow/Today. If this is non-gameplay ` +
    `(e.g. a log timestamp) approve; otherwise switch to TimeModel. See bonfolit-standards doc 05.`);
}

allow();
