# Logica Context — Benchmarks

## Context Savings

| Scenario | Without LC | With LC | Savings |
|----------|-----------|---------|---------|
| `git log` (100 commits) | ~8,000 tokens | ~200 tokens | 97.5% |
| `cat large-file.ts` (500 lines) | ~4,000 tokens | ~150 tokens | 96.3% |
| `npm ls --all` | ~12,000 tokens | ~300 tokens | 97.5% |
| `find . -name "*.ts"` (200 files) | ~3,000 tokens | ~100 tokens | 96.7% |
| Fetch HTML page (50KB) | ~12,500 tokens | ~500 tokens | 96.0% |

## Performance

| Operation | Time |
|-----------|------|
| MCP server startup | ~150ms |
| Index 10KB text | ~5ms |
| FTS5 search (1000 entries) | ~2ms |
| Batch execute (3 commands) | ~500ms |
| Fetch + index URL | ~1-3s |

## Session Continuity

| Metric | Value |
|--------|-------|
| Snapshot size | ~2KB |
| Events stored per session | unlimited |
| Snapshot build time | ~1ms |
| Context recovery accuracy | ~95% |

*Benchmarks measured on Apple M1, Node.js 20, SQLite 3.45*
