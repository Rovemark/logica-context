# Logica Context — Claude Code Configuration

## Context Window Protection

Use Logica Context MCP tools to keep raw data in the sandbox:

1. **GATHER**: `lctx_batch_execute(commands, queries)` — Primary tool for research
2. **FOLLOW-UP**: `lctx_search(queries)` — For all follow-up questions
3. **PROCESSING**: `lctx_execute(language, code)` — For log analysis and data processing

## Rules
- Do NOT use Bash for commands producing >20 lines of output
- Do NOT use Read for analysis (use `lctx_execute_file`). Read IS correct for files you intend to Edit
- Do NOT use WebFetch (use `lctx_fetch_and_index` instead)
- Bash is ONLY for git/mkdir/rm/mv/navigation
