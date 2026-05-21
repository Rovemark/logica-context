#!/usr/bin/env node
// hooks/posttooluse.mjs — Captures tool results into session event store
// v2 (2026-05-21): auto-detect decisions in outputs + ensure decisions table

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const input = JSON.parse(process.argv[2] || '{}');
const tool = input.tool_name || '';
const toolInput = input.tool_input || {};
const toolOutput = input.tool_response || '';
const sessionId = process.env.CLAUDE_SESSION_ID || 'default';

// Skip recording our own tools to avoid infinite recursion
if (tool.startsWith('lctx_')) process.exit(0);

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

function summarizeOutput(output) {
  if (typeof output === 'string') return output.slice(0, 300);
  if (typeof output === 'object') return JSON.stringify(output).slice(0, 300);
  return String(output).slice(0, 300);
}

function tokensSaved(output) {
  const len = typeof output === 'string' ? output.length : JSON.stringify(output || '').length;
  return Math.max(0, Math.floor(len / 4) - 100);
}

// NEW v2: detect decision-like content in tool outputs
function detectDecisions(name, inp, output) {
  const decisions = [];
  const outStr = typeof output === 'string' ? output : JSON.stringify(output || '');
  
  // Pattern 1: explicit "decision:" markers
  const explicitDecisions = outStr.match(/(?:DECISION|DECIDE[D]?|CHOSE|RESOLVED?):\s*([^\n]{20,200})/gi) || [];
  decisions.push(...explicitDecisions.map(d => d.replace(/^(DECISION|DECIDED?|CHOSE|RESOLVED?):\s*/i, '').trim()));
  
  // Pattern 2: Edit/Write to important config files (likely architectural decision)
  if (['Edit', 'Write'].includes(name)) {
    const filePath = inp.file_path || '';
    const importantConfigs = [
      /\.env$/, /package\.json$/, /tsconfig\.json$/, /docker-compose\.ya?ml$/,
      /squad\.ya?ml$/, /IDENTITY\.md$/, /SOUL\.md$/, /CLAUDE\.md$/,
      /settings\.(json|yaml)$/, /\.mcp\.json$/, /CHANGELOG\.md$/,
    ];
    if (importantConfigs.some(p => p.test(filePath))) {
      decisions.push(`Modified ${filePath.split('/').slice(-3).join('/')}`);
    }
  }
  
  return decisions;
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
    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      decision_text TEXT NOT NULL,
      context TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_decisions_session ON decisions(session_id, created_at DESC);
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

  // NEW v2: auto-log detected decisions
  const detected = detectDecisions(tool, toolInput, toolOutput);
  if (detected.length > 0) {
    const insertDecision = db.prepare(`INSERT INTO decisions (session_id, decision_text, context) VALUES (?, ?, ?)`);
    for (const dec of detected) {
      insertDecision.run(sessionId, dec, `auto-detected from ${tool}`);
    }
  }

  db.close();
} catch {
  // Silent
}
