# Changelog
## [1.3.0] - 2026-05-21

### Added — Memory Persistence + Token Economy v2

- **Cross-session decisions table** — new `decisions` table in SQLite. Auto-populated by `posttooluse.mjs` when:
  - Tool output contains explicit `DECISION:`, `DECIDED:`, `CHOSE:`, `RESOLVED:` markers
  - Edit/Write touches critical config files (`.env`, `package.json`, `tsconfig`, `IDENTITY.md`, `squad.yaml`, etc.)
- **Tier 0 in snapshots** — `precompact.mjs` now includes cross-session decisions (last 7 days) at highest priority in snapshot XML
- **Errors-encountered tier** — `precompact.mjs` captures error/exception patterns from outputs (separate tier)
- **SessionStart multi-source recall**: now injects (1) last snapshot, (2) cross-session decisions last 14d, (3) outstanding pendings (TODO/FIXME from last 7d)
- **Decision logging instructions** in SessionStart — Claude is now informed how to manually log decisions via SQL into the decisions table
- **PreTool strict mode** (`LCTX_STRICT=1`): blocks Bash commands matching "massive output" patterns (recursive find/grep, unlimited git log, npm ls full, etc.) and forces `lctx_execute` alternative

### Changed

- Snapshot max size 2048 → 3072 bytes (room for Tier 0)
- `pretooluse.mjs` rewrites Bash suggestions with severity tags (high/medium/low)
- WebFetch flagged as high-severity by default (recommends `lctx_fetch_and_index`)

### Improved

- Documentation clarity in hooks
- Indexed `decisions` table for fast cross-session retrieval
- Hooks remain backward-compatible (no schema breaking)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Nothing yet

## [1.2.0] - 2026-04-14

### Added
- `lctx_upgrade` auto-update command with version diff
- MCP Aggregator: client detection across all platforms (Cursor, Gemini CLI, VS Code Copilot, OpenCode, Kiro, Zed, Codex)
- Semantic search disambiguation: Voyage AI vs. OpenAI auto-selection
- Batch execute: parallel execution with configurable concurrency
- Dashboard web UI: real-time token budget visualization
- `lctx_mcp` client-side config reader for all 8 platforms

### Fixed
- Session snapshot race condition on rapid tool calls
- Path restriction false-positive on `.envrc` files
- SQLite WAL mode not enabled on cold start

### Changed
- Output truncation now preserves last N lines instead of first N (more relevant for shell output)
- Improved error messages across sandbox timeout scenarios

## [1.1.0] - 2026-04-13

### Added
- Cross-session memory via Supabase (persist knowledge base across restarts)
- Team knowledge base: `lctx_team_push` and `lctx_team_search`
- Context budget tracker: `lctx_budget` with visual bar and per-tool breakdown
- Git-aware indexing: `lctx_git` with branch, diff, and commit history
- Project DNA scanner: `lctx_scan` auto-detects stack, languages, frameworks
- 8 platform configs (Claude Code, Cursor, Gemini CLI, VS Code Copilot, Codex, Kiro, Zed, OpenCode)

### Fixed
- Hook crash isolation: all 6 hooks now wrapped in `try/catch` at top level
- Output sanitization: improved regex for AWS secret key patterns

## [1.0.0] - 2026-04-13

### Added
- 17 MCP tools for context window protection
- SQLite FTS5 knowledge base with BM25 ranking
- Sandboxed execution (shell, node, python, ruby, go, swift, rust, deno)
- URL fetch with HTML-to-markdown conversion
- Session continuity with priority-tiered snapshots
- 6 Claude Code hooks (SessionStart, PreToolUse, PostToolUse, PreCompact, UserPromptSubmit, RoutingBlock)
- Security layer (command validation, path restrictions, output sanitization)
- Exit code classification for error recovery
- Project DNA scanner (auto-detect stack, languages, frameworks)
- Semantic search via Voyage AI or OpenAI embeddings
- Context budget tracker with visual bar
- Git-aware indexing (branch, diff, commits)
- MCP aggregator (list servers, estimate context cost)
- Team knowledge base (shared indexing via Supabase)
- Cross-session memory (Supabase persistence)
- 8 platform configs (Claude Code, Cursor, Gemini CLI, VS Code Copilot, Codex, Kiro, Zed, OpenCode)
- CLI with doctor, stats, purge, upgrade commands
- Dashboard web UI
- Vitest test suite (26 tests)
- CI workflow (GitHub Actions)

[Unreleased]: https://github.com/Rovemark/logica-context/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/Rovemark/logica-context/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Rovemark/logica-context/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Rovemark/logica-context/releases/tag/v1.0.0
