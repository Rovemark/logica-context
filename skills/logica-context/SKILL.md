# Logica Context

Protects your AI context window via sandboxed execution and smart indexing.

## Tools

- `lctx_batch_execute` — Run N commands + N search queries in one call
- `lctx_execute` — Sandboxed code execution (shell, node, python, etc.)
- `lctx_execute_file` — Process files in sandbox
- `lctx_index` — Index text into knowledge base
- `lctx_search` — BM25 full-text search
- `lctx_fetch_and_index` — Fetch URL, convert to markdown, index

## Best Practices

- Use `lctx_batch_execute` for research (one call replaces many)
- Use `lctx_search` for follow-up questions
- Use `lctx_execute` for log analysis and data processing
- Avoid raw Bash for large-output commands
