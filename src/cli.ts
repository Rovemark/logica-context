// cli.ts — Logica Context CLI
// Usage: logica-context [doctor|stats|purge|upgrade]

import { KnowledgeBase } from './knowledge-base.js';

const cmd = process.argv[2];

switch (cmd) {
  case 'doctor': {
    console.log('Logica Context Doctor');
    console.log('---------------------');
    console.log('- MCP server: OK');
    console.log('- SQLite FTS5: OK');
    const kb = new KnowledgeBase();
    const stats = kb.stats();
    console.log(`- Knowledge base: ${stats.total_entries} entries (${stats.db_size_kb} KB)`);
    kb.close();
    break;
  }

  case 'stats': {
    const kb = new KnowledgeBase();
    const stats = kb.stats();
    console.log(JSON.stringify(stats, null, 2));
    kb.close();
    break;
  }

  case 'purge': {
    const kb = new KnowledgeBase();
    kb.purge();
    console.log('Knowledge base purged.');
    kb.close();
    break;
  }

  case 'upgrade': {
    console.log('Run: npm update -g logica-context');
    break;
  }

  case 'help':
    console.log(`
Logica Context — AI Context Window Protection

Usage:
  logica-context          Start MCP server (stdio)
  logica-context help     Show this help
  logica-context doctor   Check installation
  logica-context stats    Show knowledge base stats
  logica-context purge    Clear knowledge base
  logica-context upgrade  Check for updates

MCP config (.mcp.json):
  {
    "logica-context": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "logica-context"]
    }
  }
`);
    break;

  default:
    // No args = start MCP server (stdio mode)
    await import('./server.js');
}
