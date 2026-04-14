#!/usr/bin/env node
// hooks/sessionstart.mjs — Injects context protection instructions + previous session snapshot

import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { join } from 'path';

// Try to load previous session snapshot
let snapshot = '';
try {
  const dbPath = join(process.cwd(), '.logica-context', 'sessions.db');
  if (existsSync(dbPath)) {
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare('SELECT snapshot_xml FROM snapshots ORDER BY created_at DESC LIMIT 1').get();
    if (row?.snapshot_xml) {
      snapshot = `\n<session-continuity>\n${row.snapshot_xml}\n</session-continuity>`;
    }
    db.close();
  }
} catch {}

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

  <commands>
    When the user says "lctx stats" or asks about context savings:
    → Call lctx_stats and display the full output.

    When the user says "lctx doctor" or asks to diagnose:
    → Call lctx_doctor and display results as a checklist.

    When the user says "lctx purge":
    → Call lctx_purge to wipe the knowledge base.
  </commands>
</context_window_protection>${snapshot}`);
