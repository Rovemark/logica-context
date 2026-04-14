// session-store.ts — Per-project SQLite event store for session continuity
// Tracks every tool call so context can be reconstructed after compaction
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface SessionEvent {
  id?: number;
  session_id: string;
  tool_name: string;
  tool_input_summary: string;
  tool_output_summary: string;
  timestamp: string;
  tokens_saved: number;
}

export interface SessionSummary {
  session_id: string;
  total_events: number;
  tools_used: string[];
  first_event: string;
  last_event: string;
  total_tokens_saved: number;
}

export class SessionStore {
  private db: Database.Database;

  constructor(projectDir?: string) {
    const dataDir = projectDir
      ? join(projectDir, '.logica-context')
      : join(homedir(), '.logica-context');

    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

    const dbPath = join(dataDir, 'sessions.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        tool_input_summary TEXT NOT NULL,
        tool_output_summary TEXT NOT NULL,
        timestamp TEXT DEFAULT (datetime('now')),
        tokens_saved INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);

      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        snapshot_xml TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_session ON snapshots(session_id);
    `);
  }

  recordEvent(event: Omit<SessionEvent, 'id' | 'timestamp'>): void {
    this.db.prepare(`
      INSERT INTO events (session_id, tool_name, tool_input_summary, tool_output_summary, tokens_saved)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      event.session_id,
      event.tool_name,
      event.tool_input_summary.slice(0, 500),
      event.tool_output_summary.slice(0, 1000),
      event.tokens_saved
    );
  }

  getSessionEvents(sessionId: string, limit = 50): SessionEvent[] {
    return this.db.prepare(`
      SELECT * FROM events WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?
    `).all(sessionId, limit) as SessionEvent[];
  }

  getSessionSummary(sessionId: string): SessionSummary | null {
    const events = this.getSessionEvents(sessionId, 1000);
    if (events.length === 0) return null;

    const tools = [...new Set(events.map(e => e.tool_name))];

    return {
      session_id: sessionId,
      total_events: events.length,
      tools_used: tools,
      first_event: events[events.length - 1].timestamp,
      last_event: events[0].timestamp,
      total_tokens_saved: events.reduce((sum, e) => sum + e.tokens_saved, 0),
    };
  }

  getRecentSessions(limit = 5): SessionSummary[] {
    const sessions = this.db.prepare(`
      SELECT DISTINCT session_id FROM events ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as { session_id: string }[];

    return sessions
      .map(s => this.getSessionSummary(s.session_id))
      .filter(Boolean) as SessionSummary[];
  }

  saveSnapshot(sessionId: string, snapshotXml: string): void {
    this.db.prepare(`
      INSERT INTO snapshots (session_id, snapshot_xml) VALUES (?, ?)
    `).run(sessionId, snapshotXml);
  }

  getLatestSnapshot(sessionId: string): string | null {
    const row = this.db.prepare(`
      SELECT snapshot_xml FROM snapshots WHERE session_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(sessionId) as { snapshot_xml: string } | undefined;

    return row?.snapshot_xml || null;
  }

  getLatestSnapshotAnySession(): string | null {
    const row = this.db.prepare(`
      SELECT snapshot_xml FROM snapshots ORDER BY id DESC LIMIT 1
    `).get() as { snapshot_xml: string } | undefined;

    return row?.snapshot_xml || null;
  }

  pruneOldEvents(daysToKeep = 7): number {
    const result = this.db.prepare(`
      DELETE FROM events WHERE datetime(timestamp) < datetime('now', '-' || ? || ' days')
    `).run(daysToKeep);

    return result.changes;
  }

  close(): void {
    this.db.close();
  }
}
