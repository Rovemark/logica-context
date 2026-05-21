#!/usr/bin/env node
// hooks/pretooluse.mjs — Intercepts tool calls, suggests/blocks lctx alternatives
// v2 (2026-05-21): added soft-block pra commands que geram massive output
// Pode bloquear se LCTX_STRICT=1 no env

const input = JSON.parse(process.argv[2] || '{}');
const tool = input.tool_name || '';
const args = input.tool_input || {};

const STRICT = process.env.LCTX_STRICT === '1';
const tips = [];
let block = false;

// Bash: detect commands com output potencialmente massive
if (tool === 'Bash') {
  const cmd = args.command || '';
  
  // Patterns que geralmente produzem >1k linhas
  const massivePatterns = [
    /^find\s+\/(?!tmp)/,           // find na raiz (não /tmp)
    /^find\s+[~.\/].*?-print/,     // find recursivo com print
    /\b(grep|rg)\s+-r\b/,          // recursive grep
    /^cat\s+.*\.log$/,             // cat de log file
    /^npm\s+(ls|list)(?!.*--depth)/, // npm ls sem depth
    /\bgit\s+log\b(?!.*-n\s+\d+)(?!.*--oneline\s*$)/, // git log sem limit
    /\bls\s+-R\b/,                  // ls recursive
    /^docker\s+logs\b(?!.*--tail)/, // docker logs sem tail
    /^kubectl\s+logs\b(?!.*--tail)/,// kubectl logs sem tail
    /^journalctl\b(?!.*-n\s+)/,    // journalctl sem -n
    /^dmesg\b/,                     // dmesg sempre verbose
    /^ps\s+aux\b/,                  // ps aux full
    /^netstat\b/, /^ss\s+-/,        // network listing
  ];
  
  const isMassive = massivePatterns.some(p => p.test(cmd));
  
  if (isMassive) {
    tips.push({
      severity: 'high',
      tip: `🚫 This command likely produces massive output (>1k lines). REPLACE with:\n  lctx_execute({language: 'shell', code: '${cmd.replace(/'/g, "\\'")}'}) — output indexed in sandbox\n  Then: lctx_search(["relevant query"])`,
    });
    if (STRICT) block = true;
  } else {
    // Lighter check: known verbose commands
    const verboseCommands = ['find', 'grep', 'rg', 'cat', 'head', 'tail', 'git log', 'git diff', 'npm list', 'ls -R'];
    if (verboseCommands.some(c => cmd.startsWith(c) || cmd.includes(` ${c} `))) {
      tips.push({
        severity: 'medium',
        tip: 'This command may produce large output. Consider lctx_execute to keep output in the sandbox.',
      });
    }
  }
}

// WebFetch always wins via lctx_fetch_and_index
if (tool === 'WebFetch') {
  tips.push({
    severity: 'high',
    tip: '🚫 Use lctx_fetch_and_index instead — fetches, converts to markdown, indexes automatically.',
  });
  if (STRICT) block = true;
}

// Read of file potentially large
if (tool === 'Read' && !args.limit && !args.offset) {
  const path = args.file_path || '';
  // Skip if obviously small file
  const skipExtensions = ['.json', '.yaml', '.yml', '.toml', '.env', '.md'];
  const looksConfig = skipExtensions.some(ext => path.endsWith(ext));
  
  if (!looksConfig) {
    tips.push({
      severity: 'low',
      tip: 'For analysis, prefer lctx_execute_file — only your summary enters context. Read is correct if you plan to Edit.',
    });
  }
}

// Block in strict mode if severity high
if (block) {
  console.error(`<context_guidance_block severity="high">
${tips.map(t => `<tip>${t.tip}</tip>`).join('\n')}

Set LCTX_STRICT=0 to disable blocking (suggestions only).
</context_guidance_block>`);
  process.exit(2);
}

// Sugestões (non-blocking)
if (tips.length > 0) {
  const guidance = tips.map(t => `[${t.severity}] ${t.tip}`).join('\n\n');
  console.log(`<context_guidance>\n<tip>\n${guidance}\n</tip>\n</context_guidance>`);
}
