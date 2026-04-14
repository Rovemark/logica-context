#!/usr/bin/env node
// hooks/precompact.mjs — Saves session snapshot before Claude Code compresses conversation
// This is the CRITICAL hook: it preserves context that would otherwise be lost during compaction.
// The snapshot is a priority-tiered XML (~2KB) reinjectados no SessionStart.

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
const MAX_SNAPSHOT = 2048;

try {
  const dataDir = join(process.cwd(), '.logica-context');
  if (!existsSync(dataDir)) process.exit(0);

  const dbPath = join(dataDir, 'sessions.db');
  if (!existsSync(dbPath)) process.exit(0);

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Ensure snapshots table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      snapshot_xml TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Get recent events for this session
  const events = db.prepare(`
    SELECT tool_name, tool_input_summary, tool_output_summary, timestamp, tokens_saved
    FROM events WHERE session_id = ? ORDER BY timestamp DESC LIMIT 100
  `).all(sessionId);

  if (events.length === 0) { db.close(); process.exit(0); }

  // Build snapshot
  const edits = events.filter(e => ['Edit', 'Write', 'NotebookEdit'].includes(e.tool_name));
  const cmds = events.filter(e => e.tool_name === 'Bash');
  const reads = events.filter(e => ['Read', 'Grep', 'Glob'].includes(e.tool_name));
  const totalTokens = events.reduce((s, e) => s + (e.tokens_saved || 0), 0);
  const tools = [...new Set(events.map(e => e.tool_name))];

  let xml = '<session-snapshot>\n';

  // Tier 1 — Identity
  xml += `  <session-identity priority="1">
    session: ${sessionId}
    events: ${events.length}
    tools: ${tools.join(', ')}
    tokens_saved: ${totalTokens}
    period: ${events[events.length - 1].timestamp} → ${events[0].timestamp}
  </session-identity>\n`;

  // Tier 2 — Files modified
  if (edits.length > 0) {
    const editLines = edits.slice(0, 10).map(e => `    ${e.tool_name}: ${e.tool_input_summary}`).join('\n');
    xml += `  <files-modified priority="2">\n${editLines}\n  </files-modified>\n`;
  }

  // Tier 3 — Commands run
  if (cmds.length > 0) {
    const cmdLines = cmds.slice(0, 8).map(e => `    $ ${e.tool_input_summary.slice(0, 100)}`).join('\n');
    xml += `  <commands-run priority="3">\n${cmdLines}\n  </commands-run>\n`;
  }

  // Tier 4 — Files explored
  if (reads.length > 0) {
    const readLines = reads.slice(0, 8).map(e => `    ${e.tool_name}: ${e.tool_input_summary}`).join('\n');
    xml += `  <files-explored priority="4">\n${readLines}\n  </files-explored>\n`;
  }

  xml += '</session-snapshot>';

  // Truncate if needed
  if (xml.length > MAX_SNAPSHOT) {
    xml = xml.slice(0, MAX_SNAPSHOT - 20) + '\n</session-snapshot>';
  }

  // Save snapshot
  db.prepare(`INSERT INTO snapshots (session_id, snapshot_xml) VALUES (?, ?)`).run(sessionId, xml);

  // Output snapshot for Claude Code to capture
  console.log(xml);

  db.close();
} catch {
  // Silent — hooks must never crash
}
