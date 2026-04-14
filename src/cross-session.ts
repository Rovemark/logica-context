// cross-session.ts — Persiste conhecimento entre sessões via Supabase
// SessionStart carrega memória da sessão anterior, funciona offline com SQLite

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { SupabaseAdapter } from './supabase-adapter.js';

export interface CrossSessionMemory {
  id?: number;
  project_id: string;
  key: string;
  value: string;
  created_at?: string;
  updated_at?: string;
}

export interface SessionStartResult {
  loaded: number;
  memories: CrossSessionMemory[];
  summary: string;
  from_remote: boolean;
}

export class CrossSessionManager {
  private db: Database.Database;
  private supabase: SupabaseAdapter | null;
  private projectId: string;

  constructor(projectDir?: string, supabase?: SupabaseAdapter | null) {
    const dataDir = projectDir
      ? join(projectDir, '.logica-context')
      : join(homedir(), '.logica-context');

    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

    const dbPath = join(dataDir, 'cross-session.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.projectId = process.env.LOGICA_PROJECT_ID || 'default';
    this.supabase = supabase ?? SupabaseAdapter.fromEnv();
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(project_id, key)
      );
      CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id);
    `);
  }

  // Store a key-value memory for the current project
  remember(key: string, value: string): void {
    this.db.prepare(`
      INSERT INTO memories (project_id, key, value)
      VALUES (?, ?, ?)
      ON CONFLICT(project_id, key) DO UPDATE SET
        value = excluded.value,
        updated_at = datetime('now')
    `).run(this.projectId, key, value);

    // Async push to Supabase if available
    if (this.supabase) {
      this.supabase.pushEntry(`memory:${this.projectId}:${key}`, value).catch(() => {});
    }
  }

  // Recall a specific memory
  recall(key: string): string | null {
    const row = this.db.prepare(
      `SELECT value FROM memories WHERE project_id = ? AND key = ?`
    ).get(this.projectId, key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  // Load all memories for this project (session start)
  async sessionStart(): Promise<SessionStartResult> {
    const local = this.db.prepare(
      `SELECT * FROM memories WHERE project_id = ? ORDER BY updated_at DESC LIMIT 50`
    ).all(this.projectId) as CrossSessionMemory[];

    // If Supabase available, try to pull remote memories
    let fromRemote = false;
    if (this.supabase && local.length === 0) {
      try {
        const remote = await this.supabase.searchRemote(`memory:${this.projectId}`, 50);
        if (remote.length > 0) {
          fromRemote = true;
          // Hydrate local from remote
          const insert = this.db.prepare(`
            INSERT OR IGNORE INTO memories (project_id, key, value)
            VALUES (?, ?, ?)
          `);
          const tx = this.db.transaction(() => {
            for (const r of remote) {
              const key = r.source.replace(`memory:${this.projectId}:`, '');
              insert.run(this.projectId, key, r.content);
            }
          });
          tx();
          const hydrated = this.db.prepare(
            `SELECT * FROM memories WHERE project_id = ? ORDER BY updated_at DESC LIMIT 50`
          ).all(this.projectId) as CrossSessionMemory[];
          return this.buildResult(hydrated, true);
        }
      } catch { /* Supabase offline — no problem */ }
    }

    return this.buildResult(local, fromRemote);
  }

  private buildResult(memories: CrossSessionMemory[], fromRemote: boolean): SessionStartResult {
    const summary = memories.length === 0
      ? 'No previous memories for this project.'
      : `Loaded ${memories.length} memories for project "${this.projectId}":\n` +
        memories.slice(0, 10).map(m => `  • ${m.key}: ${m.value.slice(0, 80)}`).join('\n') +
        (memories.length > 10 ? `\n  ... and ${memories.length - 10} more` : '');

    return { loaded: memories.length, memories, summary, from_remote: fromRemote };
  }

  // List all keys for this project
  listKeys(): string[] {
    const rows = this.db.prepare(
      `SELECT key FROM memories WHERE project_id = ? ORDER BY updated_at DESC`
    ).all(this.projectId) as { key: string }[];
    return rows.map(r => r.key);
  }

  // Forget a key
  forget(key: string): boolean {
    const result = this.db.prepare(
      `DELETE FROM memories WHERE project_id = ? AND key = ?`
    ).run(this.projectId, key);
    return result.changes > 0;
  }

  close(): void {
    this.db.close();
  }
}
