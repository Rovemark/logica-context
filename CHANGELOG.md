# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/Rovemark/logica-context/releases/tag/v1.0.0
