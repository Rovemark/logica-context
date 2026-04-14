// knowledge-base.ts — SQLite FTS5 knowledge base for context indexing
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface SearchResult {
  id: number;
  source: string;
  content: string;
  rank: number;
  indexed_at: string;
}

export interface IndexStats {
  total_entries: number;
  total_sources: number;
  db_size_kb: number;
}

export class KnowledgeBase {
  private db: Database.Database;

  constructor(projectDir?: string) {
    const dataDir = projectDir
      ? join(projectDir, '.logica-context')
      : join(homedir(), '.logica-context');

    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

    const dbPath = join(dataDir, 'knowledge.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        content TEXT NOT NULL,
        indexed_at TEXT DEFAULT (datetime('now')),
        ttl_hours INTEGER DEFAULT 0
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
        source, content, content=documents, content_rowid=id,
        tokenize='porter unicode61'
      );

      CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
        INSERT INTO documents_fts(rowid, source, content) VALUES (new.id, new.source, new.content);
      END;

      CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, source, content) VALUES ('delete', old.id, old.source, old.content);
      END;

      CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
        INSERT INTO documents_fts(documents_fts, rowid, source, content) VALUES ('delete', old.id, old.source, old.content);
        INSERT INTO documents_fts(rowid, source, content) VALUES (new.id, new.source, new.content);
      END;
    `);
  }

  index(source: string, content: string, ttlHours = 0): number {
    // Remove expired entries for this source
    this.db.prepare(`DELETE FROM documents WHERE source = ? AND ttl_hours > 0 AND datetime(indexed_at, '+' || ttl_hours || ' hours') < datetime('now')`).run(source);

    // Upsert: replace if same source exists
    this.db.prepare(`DELETE FROM documents WHERE source = ?`).run(source);

    const result = this.db.prepare(
      `INSERT INTO documents (source, content, ttl_hours) VALUES (?, ?, ?)`
    ).run(source, content, ttlHours);

    return result.lastInsertRowid as number;
  }

  indexChunked(source: string, content: string, chunkSize = 2000, ttlHours = 0): number {
    this.db.prepare(`DELETE FROM documents WHERE source = ?`).run(source);

    const chunks = this.chunkText(content, chunkSize);
    let count = 0;

    const insert = this.db.prepare(
      `INSERT INTO documents (source, content, ttl_hours) VALUES (?, ?, ?)`
    );

    const tx = this.db.transaction(() => {
      for (const chunk of chunks) {
        insert.run(`${source}#chunk${count}`, chunk, ttlHours);
        count++;
      }
    });

    tx();
    return count;
  }

  search(query: string, limit = 20): SearchResult[] {
    // Clean expired entries
    this.db.prepare(
      `DELETE FROM documents WHERE ttl_hours > 0 AND datetime(indexed_at, '+' || ttl_hours || ' hours') < datetime('now')`
    ).run();

    return this.db.prepare(`
      SELECT d.id, d.source, d.content, rank, d.indexed_at
      FROM documents_fts f
      JOIN documents d ON d.id = f.rowid
      WHERE documents_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit) as SearchResult[];
  }

  stats(): IndexStats {
    const total = this.db.prepare(`SELECT COUNT(*) as count FROM documents`).get() as { count: number };
    const sources = this.db.prepare(`SELECT COUNT(DISTINCT source) as count FROM documents`).get() as { count: number };
    const pageCount = this.db.prepare(`PRAGMA page_count`).get() as { page_count: number };
    const pageSize = this.db.prepare(`PRAGMA page_size`).get() as { page_size: number };

    return {
      total_entries: total.count,
      total_sources: sources.count,
      db_size_kb: Math.round((pageCount.page_count * pageSize.page_size) / 1024),
    };
  }

  purge(): void {
    this.db.exec(`DELETE FROM documents`);
  }

  close(): void {
    this.db.close();
  }

  private chunkText(text: string, size: number): string[] {
    const chunks: string[] = [];
    const lines = text.split('\n');
    let current = '';

    for (const line of lines) {
      if (current.length + line.length + 1 > size && current.length > 0) {
        chunks.push(current.trim());
        current = '';
      }
      current += line + '\n';
    }

    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }
}
