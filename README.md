# Logica Context

MCP server that protects your AI context window via sandboxed execution and smart indexing.

## Why?

AI coding assistants have limited context windows. When you run `git log` or `cat large-file.ts`, the raw output floods your conversation, consuming tokens. Logica Context intercepts these operations, executes them in a sandbox, indexes the results, and returns only concise summaries.

## Features

- **Sandboxed execution** — Run shell, Node, Python, Ruby, Go, Swift, Rust, Deno code without polluting context
- **Smart indexing** — SQLite FTS5 knowledge base with BM25 ranking and Porter stemming
- **Batch operations** — Run multiple commands + queries in a single call
- **URL fetching** — Fetch, convert HTML to markdown, and index automatically
- **Supabase integration** — Optional cross-machine persistence via Supabase (agent memory, sessions)
- **Hooks** — PreToolUse and SessionStart hooks for Claude Code

## Quick Start

### Claude Code

Add to your `.mcp.json`:

```json
{
  "logica-context": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "logica-context"]
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `lctx_batch_execute` | Run N commands + N search queries in one call |
| `lctx_execute` | Sandboxed code execution (shell, node, python, etc.) |
| `lctx_execute_file` | Process files in sandbox |
| `lctx_index` | Index text into knowledge base |
| `lctx_search` | BM25 full-text search |
| `lctx_fetch_and_index` | Fetch URL, convert to markdown, index |
| `lctx_stats` | Knowledge base statistics |
| `lctx_doctor` | Diagnose installation |
| `lctx_upgrade` | Check for updates |
| `lctx_purge` | Clear knowledge base |

### Supabase Integration (Optional)

Set environment variables to enable cross-machine persistence:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
LCTX_SUPABASE=true
```

This enables searching agent memory, sessions, and events stored in Supabase.

## CLI

```bash
logica-context          # Start MCP server (stdio)
logica-context doctor   # Check installation
logica-context stats    # Show knowledge base stats
logica-context purge    # Clear knowledge base
```

## Development

```bash
git clone https://github.com/Rovemark/logica-context.git
cd logica-context
npm install
npm run build
```

## License

MIT
