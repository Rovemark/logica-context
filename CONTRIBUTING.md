# Contributing to Logica Context

## Setup

```bash
git clone https://github.com/Rovemark/logica-context.git
cd logica-context
npm install
```

## Development

```bash
npm run dev        # Start server with tsx (hot reload)
npm run build      # Build for production
npm test           # Run tests
npm run test:watch # Watch mode
```

## Architecture

```
src/
  server.ts          — MCP server (10 tools)
  knowledge-base.ts  — SQLite FTS5 index
  sandbox.ts         — Sandboxed execution
  security.ts        — Command/path validation
  exit-classify.ts   — Exit code classification
  fetcher.ts         — URL fetch + HTML→markdown
  session-store.ts   — Session event tracking
  snapshot-builder.ts — Context snapshot for compaction
  supabase-adapter.ts — Optional Supabase sync
  utils.ts           — Shared utilities
  cli.ts             — CLI entry point

hooks/               — Claude Code hooks (.mjs)
configs/             — Per-platform configurations
skills/              — Skill definitions
tests/               — Vitest test suites
```

## Guidelines

- Clean room implementation — no code from other projects
- Keep dependencies minimal
- All code must pass `tsc --noEmit` and `vitest run`
- Hooks must never crash — always wrap in try/catch
- Output sanitization: never leak secrets
