#!/usr/bin/env node
// hooks/precompact.mjs — Saves session snapshot before Claude Code compresses conversation
// CRITICAL hook: preserves context that would otherwise be lost during compaction.
// v2 (2026-05-21): added Tier 0 (decisions, errors, pendings) + cross-session persistence

import Database from 'better-sqlite3';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const sessionId = process.env.CLAUDE_SESSION_ID || 'default';
const MAX_SNAPSHOT = 3072; // bumped 2048 → 3072 to fit Tier 0

try {
  const dataDir = join(process.cwd(), '.logica-context');
  if (!existsSync(dataDir)) process.exit(0);

  const dbPath = join(dataDir, 'sessions.db');
  if (!existsSync(dbPath)) process.exit(0);

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Ensure snapshots + decisions tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      snapshot_xml TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      decision_text TEXT NOT NULL,
      context TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_decisions_session ON decisions(session_id, created_at DESC);
  `);

  // Recent events
  const events = db.prepare(`
    SELECT tool_name, tool_input_summary, tool_output_summary, timestamp, tokens_saved
    FROM events WHERE session_id = ? ORDER BY timestamp DESC LIMIT 200
  `).all(sessionId);

  if (events.length === 0) { db.close(); process.exit(0); }

  // Cross-session: pull recent decisions (last 7 days, any session)
  const recentDecisions = db.prepare(`
    SELECT decision_text, context, created_at FROM decisions
    WHERE created_at > datetime('now', '-7 days')
    ORDER BY created_at DESC LIMIT 5
  `).all();

  const edits = events.filter(e => ['Edit', 'Write', 'NotebookEdit'].includes(e.tool_name));
  const cmds = events.filter(e => e.tool_name === 'Bash');
  const reads = events.filter(e => ['Read', 'Grep', 'Glob'].includes(e.tool_name));
  const errors = events.filter(e => /error|failed|exception|err:/i.test(e.tool_output_summary || ''));
  const totalTokens = events.reduce((s, e) => s + (e.tokens_saved || 0), 0);
  const tools = [...new Set(events.map(e => e.tool_name))];

  let xml = '<session-snapshot>\n';

  // TIER 0 — Cross-session decisions (NEW v2 — highest value)
  if (recentDecisions.length > 0) {
    const decLines = recentDecisions.map(d => `    [${d.created_at}] ${d.decision_text.slice(0, 150)}`).join('\n');
    xml += `  <recent-decisions priority="0" note="cross-session, last 7d">\n${decLines}\n  </recent-decisions>\n`;
  }

  // Tier 1 — Identity
  xml += `  <session-identity priority="1">
    session: ${sessionId}
    events: ${events.length}
    tools: ${tools.join(', ')}
    tokens_saved: ${totalTokens}
    period: ${events[events.length - 1].timestamp} → ${events[0].timestamp}
  </session-identity>\n`;

  // Tier 1.5 — Errors found (NEW v2)
  if (errors.length > 0) {
    const errLines = errors.slice(0, 5).map(e => `    [${e.tool_name}] ${(e.tool_output_summary || '').slice(0, 120)}`).join('\n');
    xml += `  <errors-encountered priority="1">\n${errLines}\n  </errors-encountered>\n`;
  }

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

  if (xml.length > MAX_SNAPSHOT) {
    xml = xml.slice(0, MAX_SNAPSHOT - 20) + '\n</session-snapshot>';
  }

  db.prepare(`INSERT INTO snapshots (session_id, snapshot_xml) VALUES (?, ?)`).run(sessionId, xml);

  // OUTPUT pra Claude Code capturar (volta no contexto pós-compaction)
  console.log(xml);

  db.close();
} catch (err) {
  // Silent — hooks nunca devem crashar
}
