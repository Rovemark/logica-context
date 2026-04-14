// supabase-adapter.ts — Optional Supabase integration for cross-machine persistence
// Syncs knowledge base entries and agent memory to Supabase
// Activated only when SUPABASE_URL + SUPABASE_SERVICE_KEY are set

export interface SupabaseConfig {
  url: string;
  key: string;
}

export interface RemoteEntry {
  id: string;
  source: string;
  content: string;
  indexed_at: string;
  project_id?: string;
}

export class SupabaseAdapter {
  private url: string;
  private key: string;
  private projectId: string;

  constructor(config: SupabaseConfig, projectId = 'default') {
    this.url = config.url.replace(/\/$/, '');
    this.key = config.key;
    this.projectId = projectId;
  }

  static fromEnv(): SupabaseAdapter | null {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) return null;

    const projectId = process.env.LOGICA_PROJECT_ID || 'default';
    return new SupabaseAdapter({ url, key }, projectId);
  }

  // ─── Knowledge Base Sync ──────────────────────────────────────

  async pushEntry(source: string, content: string): Promise<void> {
    await this.rpc('POST', '/rest/v1/context_entries', {
      source,
      content,
      project_id: this.projectId,
      indexed_at: new Date().toISOString(),
    });
  }

  async searchRemote(query: string, limit = 10): Promise<RemoteEntry[]> {
    const params = new URLSearchParams({
      select: 'id,source,content,indexed_at',
      project_id: `eq.${this.projectId}`,
      or: `(source.ilike.%${query}%,content.ilike.%${query}%)`,
      limit: String(limit),
      order: 'indexed_at.desc',
    });

    return await this.rpc('GET', `/rest/v1/context_entries?${params}`) as RemoteEntry[];
  }

  // ─── Agent Memory Access ──────────────────────────────────────

  async searchAgentMemory(query: string, agentId?: string, limit = 10): Promise<any[]> {
    const params = new URLSearchParams({
      select: 'id,agent_id,title,content,task_type,created_at',
      or: `(title.ilike.%${query}%,content.ilike.%${query}%)`,
      limit: String(limit),
      order: 'created_at.desc',
    });

    if (agentId) params.set('agent_id', `eq.${agentId}`);

    return await this.rpc('GET', `/rest/v1/agent_memory?${params}`);
  }

  async searchSessions(query: string, limit = 10): Promise<any[]> {
    const params = new URLSearchParams({
      select: 'id,agent,task,status,created_at,result',
      or: `(task.ilike.%${query}%,result.ilike.%${query}%)`,
      limit: String(limit),
      order: 'created_at.desc',
    });

    return await this.rpc('GET', `/rest/v1/synapse_sessions?${params}`);
  }

  async searchEvents(query: string, limit = 10): Promise<any[]> {
    const params = new URLSearchParams({
      select: 'id,agent_id,event_type,payload,created_at',
      or: `(event_type.ilike.%${query}%,payload->>message.ilike.%${query}%)`,
      limit: String(limit),
      order: 'created_at.desc',
    });

    return await this.rpc('GET', `/rest/v1/agent_events?${params}`);
  }

  // ─── HTTP Helper ──────────────────────────────────────────────

  private async rpc(method: string, path: string, body?: any): Promise<any> {
    const res = await fetch(`${this.url}${path}`, {
      method,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        Prefer: method === 'POST' ? 'return=minimal' : '',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase ${res.status}: ${text}`);
    }

    if (method === 'GET') return res.json();
  }
}
