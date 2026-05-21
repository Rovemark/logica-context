#!/usr/bin/env node
// hooks/sessionstart.mjs — Injects context protection instructions + multi-source recall
// v2 (2026-05-21): now pulls (1) last session snapshot, (2) cross-session decisions, (3) outstanding TODOs

import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { join } from 'path';

let snapshot = '';
let decisions = '';
let outstanding = '';

try {
  const dbPath = join(process.cwd(), '.logica-context', 'sessions.db');
  if (existsSync(dbPath)) {
    const db = new Database(dbPath, { readonly: true });

    // 1. Last session snapshot
    const snap = db.prepare('SELECT snapshot_xml, created_at FROM snapshots ORDER BY created_at DESC LIMIT 1').get();
    if (snap?.snapshot_xml) {
      snapshot = `\n<previous-session-snapshot saved="${snap.created_at}">\n${snap.snapshot_xml}\n</previous-session-snapshot>`;
    }

    // 2. Cross-session decisions (last 14 days, deduped, top 10)
    try {
      const dec = db.prepare(`
        SELECT DISTINCT decision_text, MAX(created_at) as latest
        FROM decisions
        WHERE created_at > datetime('now', '-14 days')
        GROUP BY decision_text
        ORDER BY latest DESC LIMIT 10
      `).all();
      if (dec?.length) {
        const lines = dec.map(d => `  [${d.latest.slice(0, 10)}] ${d.decision_text.slice(0, 180)}`).join('\n');
        decisions = `\n<recent-decisions note="cross-session, last 14d">\n${lines}\n</recent-decisions>`;
      }
    } catch { /* decisions table may not exist yet */ }

    // 3. Outstanding TODOs (events with TODO/PENDING/FIX in output)
    try {
      const todos = db.prepare(`
        SELECT tool_input_summary, tool_output_summary, timestamp FROM events
        WHERE (tool_output_summary LIKE '%TODO%' OR tool_output_summary LIKE '%PENDING%' OR tool_output_summary LIKE '%FIXME%')
          AND timestamp > datetime('now', '-7 days')
        ORDER BY timestamp DESC LIMIT 5
      `).all();
      if (todos?.length) {
        const lines = todos.map(t => `  [${t.timestamp.slice(0, 10)}] ${(t.tool_output_summary || '').slice(0, 150)}`).join('\n');
        outstanding = `\n<outstanding-pendings note="from last 7d">\n${lines}\n</outstanding-pendings>`;
      }
    } catch { /* events table */ }

    db.close();
  }
} catch { /* silent */ }

console.log(`<context_window_protection>
  <priority_instructions>
    Raw tool output floods your context window. Use Logica Context MCP tools to keep raw data in the sandbox.
  </priority_instructions>

  <tool_selection_hierarchy>
    1. GATHER: lctx_batch_execute(commands, queries)
       - Primary tool for research. Runs all commands, auto-indexes, and searches.
       - ONE call replaces many individual steps.
    2. FOLLOW-UP: lctx_search(queries: ["q1", "q2", ...])
       - Use for all follow-up questions. ONE call, many queries.
    3. PROCESSING: lctx_execute(language, code) | lctx_execute_file(path, language, code)
       - Use for API calls, log analysis, and data processing.
  </tool_selection_hierarchy>

  <decision_logging note="NEW v2">
    When you make a significant decision (architectural choice, strategy pivot, technical commitment),
    call lctx_execute with language='shell' and code like:
      sqlite3 .logica-context/sessions.db "INSERT INTO decisions (session_id, decision_text, context) VALUES ('${process.env.CLAUDE_SESSION_ID || 'default'}', 'decision summary', 'why');"

    This persists the decision cross-session — next session pulls it automatically.
  </decision_logging>

  <commands>
    When the user says "lctx stats" or asks about context savings:
    → Call lctx_stats and display the full output.

    When the user says "lctx doctor" or asks to diagnose:
    → Call lctx_doctor and display results as a checklist.

    When the user says "lctx purge":
    → Call lctx_purge to wipe the knowledge base.
  </commands>
</context_window_protection>${snapshot}${decisions}${outstanding}`);
