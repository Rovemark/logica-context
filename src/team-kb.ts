// team-kb.ts — Team Knowledge Base: shared indexing between developers
// Dev A indexes → Dev B searches. Namespaced by project.

import { SupabaseAdapter } from './supabase-adapter.js';

export interface TeamEntry {
  id: string;
  source: string;
  content: string;
  author: string;
  project_id: string;
  indexed_at: string;
}

export class TeamKnowledgeBase {
  private supabase: SupabaseAdapter;
  private projectId: string;
  private author: string;

  constructor(supabase: SupabaseAdapter, projectId: string, author?: string) {
    this.supabase = supabase;
    this.projectId = projectId;
    this.author = author || process.env.USER || process.env.USERNAME || 'anonymous';
  }

  async push(source: string, content: string): Promise<void> {
    await this.supabase.pushEntry(
      `team:${this.projectId}:${this.author}:${source}`,
      content
    );
  }

  async search(query: string, limit = 10): Promise<TeamEntry[]> {
    const results = await this.supabase.searchRemote(query, limit);
    return results
      .filter(r => r.source.startsWith(`team:${this.projectId}:`))
      .map(r => {
        const parts = r.source.split(':');
        return {
          id: r.id,
          source: parts.slice(3).join(':'),
          content: r.content,
          author: parts[2] || 'unknown',
          project_id: this.projectId,
          indexed_at: r.indexed_at,
        };
      });
  }

  async searchAll(query: string, limit = 20): Promise<TeamEntry[]> {
    // Search across ALL team entries (not just this project)
    const results = await this.supabase.searchRemote(query, limit);
    return results
      .filter(r => r.source.startsWith('team:'))
      .map(r => {
        const parts = r.source.split(':');
        return {
          id: r.id,
          source: parts.slice(3).join(':'),
          content: r.content,
          author: parts[2] || 'unknown',
          project_id: parts[1] || 'unknown',
          indexed_at: r.indexed_at,
        };
      });
  }
}
