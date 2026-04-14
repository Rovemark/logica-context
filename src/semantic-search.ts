// semantic-search.ts — Semantic search using embeddings (Voyage AI or OpenAI)
// Falls back to FTS5 when embeddings are not available

export interface EmbeddingResult {
  vector: number[];
  model: string;
  tokens_used: number;
}

export interface SemanticHit {
  source: string;
  content: string;
  score: number;
}

type EmbeddingProvider = 'voyage' | 'openai' | 'none';

export class SemanticSearch {
  private provider: EmbeddingProvider;
  private apiKey: string;
  private model: string;
  private supabaseUrl: string | null;
  private supabaseKey: string | null;

  constructor() {
    // Auto-detect provider
    if (process.env.VOYAGE_API_KEY) {
      this.provider = 'voyage';
      this.apiKey = process.env.VOYAGE_API_KEY;
      this.model = process.env.VOYAGE_MODEL || 'voyage-3-lite';
    } else if (process.env.OPENAI_API_KEY) {
      this.provider = 'openai';
      this.apiKey = process.env.OPENAI_API_KEY;
      this.model = 'text-embedding-3-small';
    } else {
      this.provider = 'none';
      this.apiKey = '';
      this.model = '';
    }

    this.supabaseUrl = process.env.SUPABASE_URL || null;
    this.supabaseKey = process.env.SUPABASE_SERVICE_KEY || null;
  }

  get isAvailable(): boolean {
    return this.provider !== 'none';
  }

  get providerName(): string {
    return this.provider;
  }

  async embed(text: string): Promise<EmbeddingResult | null> {
    if (this.provider === 'none') return null;

    try {
      if (this.provider === 'voyage') {
        return await this.embedVoyage(text);
      } else {
        return await this.embedOpenAI(text);
      }
    } catch {
      return null;
    }
  }

  async search(query: string, limit = 10): Promise<SemanticHit[]> {
    if (!this.isAvailable || !this.supabaseUrl || !this.supabaseKey) return [];

    const embedding = await this.embed(query);
    if (!embedding) return [];

    try {
      // Use Supabase pgvector for similarity search
      const res = await fetch(`${this.supabaseUrl}/rest/v1/rpc/match_context_entries`, {
        method: 'POST',
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query_embedding: embedding.vector,
          match_threshold: 0.5,
          match_count: limit,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) return [];
      const results = await res.json() as any[];

      return results.map((r: any) => ({
        source: r.source || '',
        content: r.content || '',
        score: r.similarity || 0,
      }));
    } catch {
      return [];
    }
  }

  async indexWithEmbedding(source: string, content: string): Promise<boolean> {
    if (!this.isAvailable || !this.supabaseUrl || !this.supabaseKey) return false;

    const embedding = await this.embed(content.slice(0, 8000));
    if (!embedding) return false;

    try {
      const res = await fetch(`${this.supabaseUrl}/rest/v1/context_entries`, {
        method: 'POST',
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          source,
          content: content.slice(0, 10000),
          embedding: embedding.vector,
          indexed_at: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(10_000),
      });

      return res.ok;
    } catch {
      return false;
    }
  }

  private async embedVoyage(text: string): Promise<EmbeddingResult> {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: [text.slice(0, 8000)], model: this.model }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error(`Voyage API ${res.status}`);
    const data = await res.json() as any;

    return {
      vector: data.data[0].embedding,
      model: this.model,
      tokens_used: data.usage?.total_tokens || 0,
    };
  }

  private async embedOpenAI(text: string): Promise<EmbeddingResult> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: text.slice(0, 8000), model: this.model }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error(`OpenAI API ${res.status}`);
    const data = await res.json() as any;

    return {
      vector: data.data[0].embedding,
      model: this.model,
      tokens_used: data.usage?.total_tokens || 0,
    };
  }
}
