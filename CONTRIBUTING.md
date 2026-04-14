# Contributing to Logica Context

Thank you for your interest in contributing! This document explains the development workflow, architecture, and guidelines.

## Setup

```bash
git clone https://github.com/Rovemark/logica-context.git
cd logica-context
npm install
```

## Development

```bash
npm run dev        # Start server with tsx (hot reload)
npm run build      # Build for production (esbuild → dist/)
npm test           # Run full test suite (Vitest)
npm run test:watch # Watch mode
```

## Architecture

```
src/
  server.ts           — MCP server — 17 tools registered via @modelcontextprotocol/sdk
  knowledge-base.ts   — SQLite FTS5 index (BM25 + Porter stemming, tag filtering)
  sandbox.ts          — Sandboxed code execution (shell, node, python, ruby, go, swift, rust, deno)
  security.ts         — Command/path allowlist validation + output sanitization
  exit-classify.ts    — Exit code → structured result (success / error / timeout)
  fetcher.ts          — URL fetch + HTML → Markdown conversion (Turndown)
  session-store.ts    — Per-session event log + priority-tiered snapshots
  snapshot-builder.ts — Context snapshot builder for Claude /compact
  supabase-adapter.ts — Optional cross-machine persistence via Supabase
  context-budget.ts   — Context window usage tracker with visual bar
  semantic-search.ts  — Semantic search via Voyage AI or OpenAI embeddings
  git-indexer.ts      — Git-aware indexing (branch, diff, commits)
  mcp-aggregator.ts   — MCP server aggregator (list servers, estimate context cost)
  project-dna.ts      — Project DNA scanner (auto-detect stack, languages, frameworks)
  team-kb.ts          — Team knowledge base (shared indexing via Supabase)
  cross-session.ts    — Cross-session memory persistence
  utils.ts            — Shared utilities (truncation, formatting, token estimation)
  cli.ts              — CLI entry point (doctor, stats, purge, upgrade)

hooks/               — Claude Code hooks (.mjs) — SessionStart, PreToolUse, PostToolUse, PreCompact, UserPromptSubmit, RoutingBlock
configs/             — Per-platform MCP configurations (Claude Code, Cursor, Gemini CLI, VS Code Copilot, Codex, Kiro, Zed, OpenCode)
skills/              — Skill definitions for LogicaOS integration
tests/               — Vitest test suites (26+ tests across all modules)
web/                 — Dashboard web UI (index.html)
docs/                — Extended documentation
```

## Guidelines

- **Clean room** — no code copied from other projects
- **Minimal deps** — think twice before adding any dependency
- **Type safety** — all code must pass `npx tsc --noEmit` with zero errors
- **Tests** — all code must pass `npm test` (Vitest)
- **Hook resilience** — hooks must never crash; always wrap in `try/catch`
- **Secret safety** — output sanitization must never leak API keys, tokens, or credentials
- **Backward compatibility** — MCP tool signatures must not break existing integrations

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes and add/update tests
4. Run the full suite: `npm test && npm run build && npx tsc --noEmit`
5. Update `CHANGELOG.md` under `[Unreleased]`
6. Open a PR against `main` — fill in the PR template completely

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add semantic deduplication to lctx_index
fix: handle timeout in sandbox.ts for deno runtime
docs: update tools reference in README
chore: bump vitest to 3.x
```

## Reporting Issues

- **Bug?** → Use the [Bug Report template](https://github.com/Rovemark/logica-context/issues/new?template=bug_report.yml)
- **Feature idea?** → Use the [Feature Request template](https://github.com/Rovemark/logica-context/issues/new?template=feature_request.yml)
- **Security vulnerability?** → See [SECURITY.md](SECURITY.md) — do NOT open a public issue

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
