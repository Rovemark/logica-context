# Logica Context

<div align="center">

[![npm version](https://img.shields.io/npm/v/logica-context?color=blue&label=npm)](https://www.npmjs.com/package/logica-context)
[![npm downloads](https://img.shields.io/npm/dm/logica-context)](https://www.npmjs.com/package/logica-context)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/Rovemark/logica-context/actions/workflows/ci.yml/badge.svg)](https://github.com/Rovemark/logica-context/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/node/v/logica-context)](https://nodejs.org)
[![MCP Compatible](https://img.shields.io/badge/MCP-compatible-brightgreen)](https://modelcontextprotocol.io)

**MCP server that protects your AI context window via sandboxed execution and smart indexing.**

[Quick Start](#quick-start) · [Tools Reference](#tools-reference) · [Benchmarks](#benchmarks) · [Contributing](CONTRIBUTING.md)

</div>

---

## The Problem

AI coding assistants have limited context windows. When Claude runs `git log`, `cat large-file.ts`, or `npm ls --all`, the raw output floods your conversation — consuming thousands of tokens in seconds.

**Result:** Less room for actual code, more frequent context resets, interrupted workflows.

## The Solution

Logica Context sits between your AI and the shell. It intercepts operations, executes them in a sandbox, indexes results into a local SQLite knowledge base, and returns only concise summaries.

```
Without Logica Context:
  AI → run git log → 8,000 tokens consumed ❌

With Logica Context:
  AI → lctx_execute(git log) → 200 tokens, full data indexed → searchable forever ✅
```

## Benchmarks

| Scenario | Without | With | Savings |
|----------|---------|---------|---------|
| `git log` (100 commits) | ~8,000 tokens | ~200 tokens | **97.5%** |
| `cat large-file.ts` (500 lines) | ~4,000 tokens | ~150 tokens | **96.3%** |
| `npm ls --all` | ~12,000 tokens | ~300 tokens | **97.5%** |
| `find . -name "*.ts"` (200 files) | ~3,000 tokens | ~100 tokens | **96.7%** |
| Fetch HTML page (50KB) | ~12,500 tokens | ~500 tokens | **96.0%** |

*Measured on Apple M1, Node.js 20, SQLite 3.45. See [BENCHMARK.md](BENCHMARK.md) for full details.*

## Features

- 🛡️ **Sandboxed execution** — Shell, Node, Python, Ruby, Go, Swift, Rust, Deno without polluting context
- 🔍 **Smart indexing** — SQLite FTS5 knowledge base with BM25 ranking and Porter stemming
- ⚡ **Batch operations** — Run N commands + N queries in a single MCP call
- 🌐 **URL fetching** — Fetch, convert HTML → Markdown, index automatically
- 🔁 **Session continuity** — Snapshots persist context across Claude resets
- ☁️ **Supabase integration** — Optional cross-machine persistence for agent memory and sessions
- 🪝 **Claude Code hooks** — `PreToolUse` and `SessionStart` hooks for automatic interception

## Quick Start

### Claude Code (recommended)

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "logica-context": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "logica-context"]
    }
  }
}
```

Restart Claude Code — the server starts automatically.

### Global install

```bash
npm install -g logica-context
logica-context        # Start MCP server
logica-context doctor # Verify installation
```

### With Supabase (cross-machine persistence)

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
LCTX_SUPABASE=true
```

## Tools Reference

| Tool | Description | Key Params |
|------|-------------|------------|
| `lctx_batch_execute` | Run N commands + N search queries in one call | `commands[]`, `queries[]` |
| `lctx_execute` | Sandboxed code execution | `code`, `lang` (shell/node/python/ruby/go/swift/rust/deno) |
| `lctx_execute_file` | Process files without flooding context | `path`, `query` |
| `lctx_index` | Index text into the knowledge base | `content`, `source`, `tags[]` |
| `lctx_search` | BM25 full-text search over indexed data | `query`, `limit` |
| `lctx_fetch_and_index` | Fetch URL → Markdown → index | `url` |
| `lctx_stats` | Knowledge base statistics | — |
| `lctx_doctor` | Diagnose installation and dependencies | — |
| `lctx_upgrade` | Check for updates on npm | — |
| `lctx_purge` | Clear the knowledge base | `confirm` |

### Example: Batch execute

```json
{
  "tool": "lctx_batch_execute",
  "params": {
    "commands": [
      { "code": "git log --oneline -50", "lang": "shell" },
      { "code": "npm ls --all", "lang": "shell" }
    ],
    "queries": [
      { "query": "authentication functions", "limit": 5 }
    ]
  }
}
```

Returns summaries only — full output is indexed and searchable.

### Example: Index + Search

```json
// Index a document
{ "tool": "lctx_index", "params": { "content": "...", "source": "architecture.md" } }

// Search it later
{ "tool": "lctx_search", "params": { "query": "database schema", "limit": 10 } }
```

## CLI

```bash
logica-context          # Start MCP server (stdio mode)
logica-context doctor   # Check installation and runtimes
logica-context stats    # Show knowledge base stats
logica-context purge    # Clear knowledge base
```

## Comparison

| Feature | Logica Context | context7 | raw shell tools |
|---------|:-------------:|:--------:|:---------------:|
| Token savings (avg) | **~97%** | ~40% | 0% |
| Local SQLite index | ✅ | ❌ | ❌ |
| BM25 full-text search | ✅ | ✅ | ❌ |
| Session snapshots | ✅ | ❌ | ❌ |
| Supabase cross-machine sync | ✅ | ❌ | ❌ |
| Claude Code hooks | ✅ | ❌ | ❌ |
| Multi-language sandbox | ✅ (8 langs) | ❌ | partial |
| URL fetch + index | ✅ | ❌ | ❌ |
| Zero config | ✅ | ✅ | ✅ |
| Open source | ✅ | ✅ | — |

## Architecture

```
src/
  server.ts           — MCP server, 10 tools registered
  knowledge-base.ts   — SQLite FTS5 index (BM25 + Porter stemming)
  sandbox.ts          — Isolated code execution per language
  security.ts         — Command/path allowlist validation
  exit-classify.ts    — Exit code → structured result
  fetcher.ts          — URL fetch + HTML → Markdown
  session-store.ts    — Per-session event log
  snapshot-builder.ts — Context snapshot for compaction
  supabase-adapter.ts — Optional cross-machine sync
  cli.ts              — CLI entry point

hooks/                — Claude Code hook scripts (.mjs)
configs/              — Per-platform configurations
skills/               — Skill definitions for LogicaOS
docs/                 — Extended documentation
```

## Performance

| Operation | Time |
|-----------|------|
| MCP server startup | ~150ms |
| Index 10KB text | ~5ms |
| FTS5 search (1,000 entries) | ~2ms |
| Batch execute (3 commands) | ~500ms |
| Fetch + index URL | ~1–3s |

## Development

```bash
git clone https://github.com/Rovemark/logica-context.git
cd logica-context
npm install
npm run dev     # Hot reload via tsx
npm test        # Run test suite
npm run build   # Production build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, architecture deep-dive, and PR process.

## Security

See [SECURITY.md](SECURITY.md) for our vulnerability disclosure policy.

## License

MIT © [Rovemark](https://github.com/Rovemark)
