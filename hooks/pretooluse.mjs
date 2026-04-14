#!/usr/bin/env node
// hooks/pretooluse.mjs — Intercepts tool calls and suggests Logica Context alternatives
// Configured in Claude Code settings.json as a PreToolUse hook

const input = JSON.parse(process.argv[2] || '{}');
const tool = input.tool_name || '';
const args = input.tool_input || {};

const tips = [];

// Suggest sandbox for Bash commands producing large output
if (tool === 'Bash') {
  const cmd = args.command || '';
  const largeOutputCommands = ['find', 'grep', 'rg', 'cat', 'head', 'tail', 'git log', 'git diff', 'npm list', 'ls -R'];

  if (largeOutputCommands.some(c => cmd.startsWith(c) || cmd.includes(` ${c} `))) {
    tips.push({
      tip: 'This command may produce large output. Use lctx_execute or lctx_batch_execute to keep output in the sandbox.',
      tool: 'lctx_execute',
    });
  }
}

// Suggest fetch_and_index for WebFetch
if (tool === 'WebFetch') {
  tips.push({
    tip: 'Use lctx_fetch_and_index instead — it fetches, converts to markdown, and indexes automatically.',
    tool: 'lctx_fetch_and_index',
  });
}

// Suggest sandbox for Read (large files)
if (tool === 'Read' && !args.limit) {
  tips.push({
    tip: 'For analysis, use lctx_execute_file — only your summary enters the context. Read is correct if you plan to Edit.',
  });
}

if (tips.length > 0) {
  const guidance = tips.map(t => `- ${t.tip}`).join('\n');
  console.log(`<context_guidance>\n<tip>\n${guidance}\n</tip>\n</context_guidance>`);
}
