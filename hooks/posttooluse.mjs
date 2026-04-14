#!/usr/bin/env node
// hooks/posttooluse.mjs — Captures tool results into session event store
// Configured in Claude Code settings.json as a PostToolUse hook

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const input = JSON.parse(process.argv[2] || '{}');
const tool = input.tool_name || '';
const toolInput = input.tool_input || {};
const toolOutput = input.tool_response || '';
const sessionId = process.env.CLAUDE_SESSION_ID || 'default';

// Skip recording our own tools to avoid infinite recursion
if (tool.startsWith('lctx_')) process.exit(0);

// Summarize input
function summarizeInput(name, inp) {
  switch (name) {
    case 'Bash': return (inp.command || '').slice(0, 200);
    case 'Read': return inp.file_path || '';
    case 'Edit': return `${inp.file_path || ''} (${(inp.old_string || '').slice(0, 50)}→${(inp.new_string || '').slice(0, 50)})`;
    case 'Write': return inp.file_path || '';
    case 'Grep': return `${inp.pattern || ''} in ${inp.path || '.'}`;
    case 'Glob': return inp.pattern || '';
    default: return JSON.stringify(inp).slice(0, 200);
  }
}

// Summarize output
function summarizeOutput(output) {
  if (typeof output === 'string') return output.slice(0, 300);
  if (typeof output === 'object') return JSON.stringify(output).slice(0, 300);
  return String(output).slice(0, 300);
}

// Estimate tokens saved (output size that didn't enter context)
function tokensSaved(output) {
  const len = typeof output === 'string' ? output.length : JSON.stringify(output || '').length;
  return Math.max(0, Math.floor(len / 4) - 100); // rough: 4 chars/token, minus summary cost
}

try {
  const dataDir = join(process.cwd(), '.logica-context');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const db = new Database(join(dataDir, 'sessions.db'));
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      tool_input_summary TEXT NOT NULL,
      tool_output_summary TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      tokens_saved INTEGER DEFAULT 0
    );
  `);

  db.prepare(`
    INSERT INTO events (session_id, tool_name, tool_input_summary, tool_output_summary, tokens_saved)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    sessionId,
    tool,
    summarizeInput(tool, toolInput),
    summarizeOutput(toolOutput),
    tokensSaved(toolOutput)
  );

  db.close();
} catch {
  // Silent — hooks must never crash Claude Code
}
