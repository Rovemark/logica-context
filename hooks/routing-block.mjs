#!/usr/bin/env node
// hooks/routing-block.mjs — Actively blocks forbidden routing patterns
// Unlike pretooluse.mjs (which suggests), this one BLOCKS with exit code 1

const input = JSON.parse(process.argv[2] || '{}');
const tool = input.tool_name || '';
const args = input.tool_input || {};

// Block curl/wget — must use lctx_fetch_and_index
if (tool === 'Bash') {
  const cmd = (args.command || '').trim();

  // Block curl/wget (use lctx_fetch_and_index instead)
  if (/^(curl|wget)\s/i.test(cmd)) {
    console.error('BLOCKED: Use lctx_fetch_and_index instead of curl/wget to protect context window.');
    process.exit(1);
  }

  // Block commands that dump huge output without piping
  const dangerousPatterns = [
    /^cat\s+[^|]+$/,           // cat without pipe
    /^find\s+\/\s/,            // find from root
    /^ls\s+-[lR]*a?R/,         // recursive ls
    /^git\s+log\s*$/,          // git log without limit
    /^npm\s+ls\s*$/,           // npm ls without depth
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(cmd)) {
      console.error(`BLOCKED: "${cmd.slice(0, 60)}" may produce large output. Use lctx_execute or lctx_batch_execute instead.`);
      process.exit(1);
    }
  }
}

// All other tools pass through
process.exit(0);
