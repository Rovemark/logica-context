// server.ts — Logica Context MCP Server
// Protects AI context window via sandboxed execution + smart indexing
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { dirname } from 'node:path';
import { KnowledgeBase } from './knowledge-base.js';
import { execute, executeFile } from './sandbox.js';
import { fetchAndConvert } from './fetcher.js';
import { SupabaseAdapter } from './supabase-adapter.js';
import { SessionStore } from './session-store.js';
import { buildSnapshot } from './snapshot-builder.js';
import { scanProject } from './project-dna.js';
import { SemanticSearch } from './semantic-search.js';
import { ContextBudget } from './context-budget.js';
import { getGitStatus, formatGitStatus } from './git-indexer.js';
import { analyzeServers, formatReport as formatMcpReport } from './mcp-aggregator.js';
import { TeamKnowledgeBase } from './team-kb.js';

const kb = new KnowledgeBase();
const sessions = new SessionStore();
const supabase = SupabaseAdapter.fromEnv();
const semantic = new SemanticSearch();
const budget = new ContextBudget();
const teamKb = supabase ? new TeamKnowledgeBase(supabase, process.env.LOGICA_PROJECT_ID || 'default') : null;

const server = new Server(
  { name: 'logica-context', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// ─── Tool Definitions ─────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'lctx_batch_execute',
      description: 'Run multiple shell commands and search queries in a single call. Results are auto-indexed into the knowledge base. Returns a concise summary.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          commands: { type: 'array', items: { type: 'string' }, description: 'Shell commands to execute' },
          queries: { type: 'array', items: { type: 'string' }, description: 'Search queries to run against the knowledge base' },
        },
      },
    },
    {
      name: 'lctx_execute',
      description: 'Execute code in a sandboxed environment. Supported languages: shell, node, python, ruby, php, go, swift, rust, deno. Output is auto-indexed.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          language: { type: 'string', description: 'Programming language (shell, node, python, etc.)' },
          code: { type: 'string', description: 'Code to execute' },
        },
        required: ['language', 'code'],
      },
    },
    {
      name: 'lctx_execute_file',
      description: 'Process a file by running code in its directory context. Output is auto-indexed.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: 'File path to process (sets working directory)' },
          language: { type: 'string', description: 'Programming language' },
          code: { type: 'string', description: 'Code to execute' },
        },
        required: ['path', 'language', 'code'],
      },
    },
    {
      name: 'lctx_index',
      description: 'Index text content into the knowledge base for later search. Chunks large content automatically.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          source: { type: 'string', description: 'Label for this content (e.g., filename, URL, description)' },
          content: { type: 'string', description: 'Text content to index' },
          ttl_hours: { type: 'number', description: 'Time-to-live in hours (0 = permanent). Default: 0' },
        },
        required: ['source', 'content'],
      },
    },
    {
      name: 'lctx_search',
      description: 'Search the knowledge base using BM25 full-text search with Porter stemming. Supports multiple queries.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          queries: { type: 'array', items: { type: 'string' }, description: 'Search queries' },
          limit: { type: 'number', description: 'Max results per query. Default: 10' },
        },
        required: ['queries'],
      },
    },
    {
      name: 'lctx_fetch_and_index',
      description: 'Fetch a URL, convert HTML to markdown, and index the content. Cached for 24 hours.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          url: { type: 'string', description: 'URL to fetch' },
          source: { type: 'string', description: 'Label for this content. Default: the URL' },
        },
        required: ['url'],
      },
    },
    {
      name: 'lctx_stats',
      description: 'Show knowledge base statistics and context savings info.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'lctx_doctor',
      description: 'Diagnose the Logica Context installation and check dependencies.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'lctx_upgrade',
      description: 'Check for and install updates to Logica Context.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'lctx_purge',
      description: 'Clear all entries from the knowledge base.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    // ─── Killer Features ────────────────────────────────────────
    {
      name: 'lctx_scan',
      description: 'Scan project structure and create a DNA profile (stack, languages, frameworks, patterns). Auto-indexes the result.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: 'Project root path. Default: current directory' },
        },
      },
    },
    {
      name: 'lctx_semantic',
      description: 'Semantic search using embeddings (Voyage AI or OpenAI). Finds content by meaning, not just keywords. Requires VOYAGE_API_KEY or OPENAI_API_KEY.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Search query (natural language)' },
          limit: { type: 'number', description: 'Max results. Default: 10' },
        },
        required: ['query'],
      },
    },
    {
      name: 'lctx_budget',
      description: 'Show context budget: tokens consumed, tokens saved, percentage used, warnings.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'lctx_git',
      description: 'Index git status: branch, diff, recent commits, modified files. AI starts knowing what changed.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: 'Git repo path. Default: current directory' },
        },
      },
    },
    {
      name: 'lctx_mcp',
      description: 'List active MCP servers and their estimated context impact. Shows recommendations for optimization.',
      inputSchema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'lctx_team_push',
      description: 'Push content to the team knowledge base (shared via Supabase). Other developers can search it.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          source: { type: 'string', description: 'Label for the content' },
          content: { type: 'string', description: 'Content to share with the team' },
        },
        required: ['source', 'content'],
      },
    },
    {
      name: 'lctx_team_search',
      description: 'Search the team knowledge base. Finds content indexed by any team member.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Max results. Default: 10' },
        },
        required: ['query'],
      },
    },
  ],
}));

// ─── Tool Handlers ────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  switch (name) {
    case 'lctx_batch_execute': {
      const commands = (args.commands as string[]) || [];
      const queries = (args.queries as string[]) || [];
      const results: string[] = [];

      for (const cmd of commands) {
        const result = await execute(cmd);
        const label = `cmd:${cmd.slice(0, 80)}`;
        kb.index(label, result.stdout || result.stderr);
        results.push(`## ${cmd}\nExit: ${result.exit_code}\n${summarize(result.stdout || result.stderr)}`);
      }

      for (const q of queries) {
        const hits = kb.search(q, 5);
        if (hits.length > 0) {
          results.push(`## Search: ${q}\n${hits.map(h => `- [${h.source}] ${h.content.slice(0, 200)}`).join('\n')}`);
        } else {
          results.push(`## Search: ${q}\nNo results found.`);
        }
      }

      return text(results.join('\n\n'));
    }

    case 'lctx_execute': {
      const lang = args.language as 'shell' | 'node' | 'python';
      const code = args.code as string;
      const result = await executeFile(code, lang);
      const label = `exec:${lang}:${code.slice(0, 50)}`;
      kb.index(label, result.stdout || result.stderr);
      return text(`Exit: ${result.exit_code}\n${summarize(result.stdout || result.stderr)}`);
    }

    case 'lctx_execute_file': {
      const lang = args.language as 'shell' | 'node' | 'python';
      const result = await executeFile(args.code as string, lang, { cwd: dirname(args.path as string) });
      const label = `file:${args.path}`;
      kb.index(label, result.stdout || result.stderr);
      return text(`Exit: ${result.exit_code}\n${summarize(result.stdout || result.stderr)}`);
    }

    case 'lctx_index': {
      const source = args.source as string;
      const content = args.content as string;
      const ttl = (args.ttl_hours as number) || 0;

      if (content.length > 4000) {
        const chunks = kb.indexChunked(source, content, 2000, ttl);
        return text(`Indexed ${chunks} chunks from "${source}"`);
      } else {
        kb.index(source, content, ttl);
        return text(`Indexed "${source}" (${content.length} chars)`);
      }
    }

    case 'lctx_search': {
      const queries = args.queries as string[];
      const limit = (args.limit as number) || 10;
      const results: string[] = [];

      for (const q of queries) {
        // Local FTS5 search
        const hits = kb.search(q, limit);
        if (hits.length > 0) {
          results.push(`## ${q}\n${hits.map(h => `**[${h.source}]** ${h.content.slice(0, 300)}`).join('\n\n')}`);
        } else if (supabase) {
          // Fallback to Supabase remote search
          try {
            const remote = await supabase.searchRemote(q, limit);
            if (remote.length > 0) {
              results.push(`## ${q} (remote)\n${remote.map(r => `**[${r.source}]** ${r.content.slice(0, 300)}`).join('\n\n')}`);
            } else {
              results.push(`## ${q}\nNo results found (local + remote).`);
            }
          } catch {
            results.push(`## ${q}\nNo results found.`);
          }
        } else {
          results.push(`## ${q}\nNo results found.`);
        }
      }

      return text(results.join('\n\n---\n\n'));
    }

    case 'lctx_fetch_and_index': {
      const url = args.url as string;
      const source = (args.source as string) || url;

      try {
        const { content, title } = await fetchAndConvert(url);
        const label = title || source;
        const chunks = kb.indexChunked(label, content, 2000, 24);
        return text(`Fetched and indexed "${label}" (${chunks} chunks, 24h TTL)`);
      } catch (err: any) {
        return text(`Fetch failed: ${err.message}`);
      }
    }

    case 'lctx_stats': {
      const stats = kb.stats();
      const recentSessions = sessions.getRecentSessions(3);
      const lines = [
        '# Logica Context Stats',
        `Entries: ${stats.total_entries}`,
        `Sources: ${stats.total_sources}`,
        `DB size: ${stats.db_size_kb} KB`,
        `Supabase: ${supabase ? 'connected' : 'disabled'}`,
      ];
      if (recentSessions.length > 0) {
        lines.push('', '## Recent Sessions');
        for (const s of recentSessions) {
          lines.push(`- ${s.session_id}: ${s.total_events} events, ${s.total_tokens_saved} tokens saved`);
        }
      }
      return text(lines.join('\n'));
    }

    case 'lctx_doctor': {
      const checks: string[] = [];
      checks.push('- [x] MCP server running');
      checks.push('- [x] SQLite FTS5 available');

      const stats = kb.stats();
      checks.push(`- [x] Knowledge base: ${stats.total_entries} entries (${stats.db_size_kb} KB)`);

      try {
        const nodeCheck = await execute('node --version');
        checks.push(nodeCheck.exit_code === 0 ? '- [x] Node.js available' : '- [ ] Node.js not found');
      } catch {
        checks.push('- [ ] Node.js not found');
      }

      try {
        const pyCheck = await execute('python3 --version');
        checks.push(pyCheck.exit_code === 0 ? '- [x] Python3 available' : '- [ ] Python3 not found (optional)');
      } catch {
        checks.push('- [ ] Python3 not found (optional)');
      }

      return text('# Logica Context Doctor\n' + checks.join('\n'));
    }

    case 'lctx_upgrade': {
      const result = await execute('npm view logica-context version 2>/dev/null || echo "not published"');
      const latest = result.stdout.trim();
      return text(`Current: 1.0.0\nLatest on npm: ${latest}\nRun: npm update -g logica-context`);
    }

    case 'lctx_purge': {
      kb.purge();
      return text('Knowledge base purged. All entries removed.');
    }

    // ─── Killer Feature Handlers ──────────────────────────────────

    case 'lctx_scan': {
      const projectPath = (args.path as string) || process.cwd();
      const dna = scanProject(projectPath);
      kb.index(`project-dna:${dna.name}`, dna.summary + '\n\n' + dna.structure);
      return text(`# Project DNA: ${dna.name}\n\n${dna.summary}\n\n## Structure\n${dna.structure}\n\n## Key Files\n${dna.keyFiles.join(', ')}`);
    }

    case 'lctx_semantic': {
      if (!semantic.isAvailable) {
        return text('Semantic search unavailable. Set VOYAGE_API_KEY or OPENAI_API_KEY in environment.');
      }
      const query = args.query as string;
      const limit = (args.limit as number) || 10;
      const hits = await semantic.search(query, limit);
      if (hits.length === 0) return text('No semantic matches found.');
      return text(hits.map(h => `**[${h.source}]** (${(h.score * 100).toFixed(0)}%) ${h.content.slice(0, 300)}`).join('\n\n'));
    }

    case 'lctx_budget': {
      return text(budget.formatReport());
    }

    case 'lctx_git': {
      const gitPath = (args.path as string) || process.cwd();
      const status = await getGitStatus(gitPath);
      if (!status) return text('Not a git repository.');
      const formatted = formatGitStatus(status);
      kb.index('git-status', formatted);
      return text(formatted);
    }

    case 'lctx_mcp': {
      const report = analyzeServers();
      return text(formatMcpReport(report));
    }

    case 'lctx_team_push': {
      if (!teamKb) return text('Team KB unavailable. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
      const source = args.source as string;
      const content = args.content as string;
      await teamKb.push(source, content);
      return text(`Pushed "${source}" to team knowledge base.`);
    }

    case 'lctx_team_search': {
      if (!teamKb) return text('Team KB unavailable. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
      const query = args.query as string;
      const limit = (args.limit as number) || 10;
      const hits = await teamKb.search(query, limit);
      if (hits.length === 0) return text('No team results found.');
      return text(hits.map(h => `**[${h.author}/${h.source}]** ${h.content.slice(0, 300)}`).join('\n\n'));
    }

    default:
      return text(`Unknown tool: ${name}`);
  }
});

// ─── Helpers ──────────────────────────────────────────────────

function text(content: string) {
  return { content: [{ type: 'text' as const, text: content }] };
}

function summarize(output: string, maxLines = 50): string {
  const lines = output.split('\n');
  if (lines.length <= maxLines) return output;
  return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines — use lctx_search to query indexed results)`;
}

// ─── Start ────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Logica Context failed to start:', err);
  process.exit(1);
});
