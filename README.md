# Logica Context

<div align="center">

[![npm version](https://img.shields.io/npm/v/logica-context?color=blue&label=npm)](https://www.npmjs.com/package/logica-context)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/Rovemark/logica-context/actions/workflows/ci.yml/badge.svg)](https://github.com/Rovemark/logica-context/actions/workflows/ci.yml)
[![MCP Compatible](https://img.shields.io/badge/MCP-compatible-brightgreen)](https://modelcontextprotocol.io)

**Your AI forgets everything after a context reset. Ours doesn't.**

[Quick Start](#quick-start) · [What Makes It Different](#what-makes-it-different) · [All 17 Tools](#all-17-tools) · [Contributing](CONTRIBUTING.md)

</div>

---

## The Problem Everyone Has

Every MCP context server does the same thing: runs commands in a sandbox, returns summaries, saves tokens. That's table stakes.

Here's what none of them solve:

- Your AI doesn't know your project exists until you explain it. Every. Single. Session.
- Knowledge dies when the session ends. Tomorrow you start from zero.
- Your teammate indexed the same codebase yesterday. You can't access any of it.
- "Find the auth code" returns nothing because the file is called `middleware.ts`.
- You have no idea how much context you've burned. You find out when the AI starts hallucinating.
- The AI doesn't know you just pushed 3 commits. It's still referencing yesterday's code.

**Logica Context fixes all six.**

## What Makes It Different

### 1. Project DNA

Other tools: AI starts every session blind. You waste 5 minutes explaining your stack.

**Logica Context:** One call to `lctx_scan` and the AI permanently knows your project — languages, frameworks, dependencies, folder structure, patterns. Indexed. Searchable. Automatic.

```
> lctx_scan

Project DNA: my-saas-app
  Stack: Node.js, TypeScript
  Frameworks: Next.js, Prisma, Tailwind CSS, Vitest
  Languages: TypeScript (142), JavaScript (23), SQL (8)
  Patterns: component-based, page-based routing, API layer, CI/CD
  Key files: package.json, tsconfig.json, Dockerfile, .env.example
```

The AI now knows your project before you type a single word.

---

### 2. Cross-Session Memory

Other tools: session ends, everything is gone. You re-explain context every morning.

**Logica Context:** Knowledge persists between sessions via Supabase. Open a new session tomorrow and the AI already knows what you worked on, what you indexed, what you searched for. It picks up where you left off.

No other MCP server does this.

---

### 3. Team Knowledge Base

Other tools: each developer is an island. Dev A spends 30 minutes mapping the codebase. Dev B does the same thing an hour later.

**Logica Context:** `lctx_team_push` and `lctx_team_search`. Dev A indexes something, Dev B finds it. Shared knowledge base via Supabase, namespaced by project.

Your whole team builds collective AI memory.

---

### 4. Semantic Search

Other tools: keyword matching. Search "authentication" and miss `verifyJWT()` because the word "auth" isn't in the function name.

**Logica Context:** `lctx_semantic` uses real embeddings (Voyage AI or OpenAI) + pgvector for similarity search. Search by meaning, not strings. "How does login work?" finds your JWT middleware, your session store, your OAuth flow.

FTS5 keyword search is still there as the fast default. Semantic search activates when you have an API key.

---

### 5. Context Budget

Other tools: you have no idea how much context you've consumed until the AI starts forgetting things.

**Logica Context:** `lctx_budget` shows a real-time dashboard:

```
# Context Budget

[▓▓▓▓▓▓▓▓▓▓▓▓▓▓······] 72% used

Tokens consumed: 144,000
Tokens saved:    38,500
Context limit:   200,000

## Recent Tool Usage
  Bash                 in:    2,400  out:    8,200
  Read                 in:    1,800  out:    4,100
  lctx_execute         in:      200  out:    6,300

⚠ WARNING: Context 72% full. Use lctx tools to save space.
```

You see exactly where your tokens go. You optimize before it's too late.

---

### 6. Git-Aware Indexing

Other tools: the AI doesn't know you just pushed code. It's referencing stale context from 2 hours ago.

**Logica Context:** `lctx_git` indexes your current branch, recent commits, staged files, and diff summary. The AI starts every session knowing what changed.

```
> lctx_git

Branch: feat/auth-refactor
Ahead: 3 commits

## Staged (2)
  + src/middleware/jwt.ts
  + tests/auth.test.ts

## Recent Commits
  a3f8b2c refactor: extract JWT validation into middleware
  9e1d445 fix: session expiry race condition
  2b7a901 test: add auth integration tests
```

No more "can you check what I changed?" — the AI already knows.

---

### 7. MCP Aggregator

Other tools: you have 8 MCP servers loaded. Each one adds tool definitions to the context. You don't know which ones are costing you.

**Logica Context:** `lctx_mcp` reads your `.mcp.json`, lists every active server, estimates their context cost, and recommends which ones to disable.

```
> lctx_mcp

# MCP Servers

Active: 8
Estimated context cost per cycle: ~3,200 tokens

## Servers
  supabase               npx @supabase/mcp      ~800 tokens
  notion                 npx @notion/mcp         ~800 tokens
  logica-context         npx logica-context       ~150 tokens
  ...

## Recommendations
  - 8 MCP servers active. Consider disabling unused ones.
  - Heavy servers: supabase, notion. Each call uses ~800 tokens.
```

---

## Quick Start

```json
{
  "logica-context": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "logica-context"]
  }
}
```

Add to `.mcp.json`. Restart your AI. Done.

### Enable Supabase (for features 2, 3, 4)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
```

### Enable Semantic Search (feature 4)

```env
VOYAGE_API_KEY=your-key    # or OPENAI_API_KEY
```

## All 17 Tools

### Core (10 tools — what every context server should do)

| Tool | Description |
|------|-------------|
| `lctx_batch_execute` | Run N commands + N search queries in one call |
| `lctx_execute` | Sandboxed execution (shell, node, python, ruby, go, swift, rust, deno) |
| `lctx_execute_file` | Process files in sandbox |
| `lctx_index` | Index text into knowledge base |
| `lctx_search` | BM25 full-text search with Porter stemming |
| `lctx_fetch_and_index` | Fetch URL, convert HTML to markdown, auto-index |
| `lctx_stats` | Knowledge base + session statistics |
| `lctx_doctor` | Diagnose installation |
| `lctx_upgrade` | Check for updates |
| `lctx_purge` | Clear knowledge base |

### Exclusive (7 tools — what nobody else has)

| Tool | Description |
|------|-------------|
| `lctx_scan` | Project DNA — auto-detect stack, languages, frameworks, patterns |
| `lctx_semantic` | Semantic search via embeddings (Voyage AI / OpenAI + pgvector) |
| `lctx_budget` | Context budget — token tracking with visual bar + warnings |
| `lctx_git` | Git-aware indexing — branch, diff, commits, modified files |
| `lctx_mcp` | MCP aggregator — list servers, estimate context cost, optimize |
| `lctx_team_push` | Push to team knowledge base (shared via Supabase) |
| `lctx_team_search` | Search team knowledge base |

## Benchmarks

| Scenario | Without | With | Savings |
|----------|---------|------|---------|
| `git log` (100 commits) | ~8,000 tokens | ~200 tokens | **97.5%** |
| `cat` 500-line file | ~4,000 tokens | ~150 tokens | **96.3%** |
| `npm ls --all` | ~12,000 tokens | ~300 tokens | **97.5%** |
| Fetch 50KB HTML page | ~12,500 tokens | ~500 tokens | **96.0%** |

## vs. Everything Else

| | Logica Context | context-mode | Raw tools |
|---|:---:|:---:|:---:|
| Sandbox + indexing | Yes | Yes | No |
| **Project DNA** | **Yes** | No | No |
| **Cross-session memory** | **Yes** | No | No |
| **Team knowledge base** | **Yes** | No | No |
| **Semantic search** | **Yes** | No | No |
| **Context budget** | **Yes** | No | No |
| **Git-aware indexing** | **Yes** | No | No |
| **MCP aggregator** | **Yes** | No | No |
| Session continuity | Yes | Yes | No |
| Security layer | Yes | Partial | No |
| License | MIT | Elastic-2.0 | — |

## Platforms

Works with Claude Code, Cursor, Gemini CLI, VS Code Copilot, Codex, Kiro, Zed, and OpenCode. See `configs/` for per-platform setup.

## Security

Command validation, path restrictions, output sanitization, sandboxed execution with timeouts. See [SECURITY.md](SECURITY.md).

## Development

```bash
git clone https://github.com/Rovemark/logica-context.git
cd logica-context
npm install && npm test && npm run build
```

## License

[MIT](LICENSE) — use it however you want.

---

<p align="center">
Built by <a href="https://github.com/Rovemark">Rovemark</a>
</p>
