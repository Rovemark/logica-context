#!/usr/bin/env node
// hooks/userpromptsubmit.mjs — Captures user prompts into session event store
// Tracks what the user asked so snapshots can reconstruct conversation intent

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const input = JSON.parse(process.argv[2] || '{}');
const prompt = input.user_prompt || input.prompt || '';
const sessionId = process.env.CLAUDE_SESSION_ID || 'default';

if (!prompt || prompt.length < 3) process.exit(0);

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
    'UserPrompt',
    prompt.slice(0, 500),
    '',
    0
  );

  db.close();
} catch {
  // Silent
}
