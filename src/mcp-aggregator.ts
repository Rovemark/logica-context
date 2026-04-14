// mcp-aggregator.ts — Lists and manages MCP servers' impact on context
// Shows which MCPs are active, their tool count, and estimated context cost

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface McpServerInfo {
  name: string;
  command: string;
  args: string[];
  type: string;
  toolCount: number;
  estimatedTokensPerCall: number;
}

export interface McpReport {
  servers: McpServerInfo[];
  totalTools: number;
  estimatedContextCost: number;
  recommendations: string[];
}

export function getMcpConfig(): Record<string, any> {
  // Try project-level .mcp.json first, then global
  const paths = [
    join(process.cwd(), '.mcp.json'),
    join(homedir(), '.claude', '.mcp.json'),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const raw = readFileSync(p, 'utf8');
        const config = JSON.parse(raw);
        return config.mcpServers || config;
      } catch {}
    }
  }

  return {};
}

export function analyzeServers(): McpReport {
  const config = getMcpConfig();
  const servers: McpServerInfo[] = [];
  const recommendations: string[] = [];

  for (const [name, cfg] of Object.entries(config)) {
    const server = cfg as any;
    const info: McpServerInfo = {
      name,
      command: server.command || '',
      args: server.args || [],
      type: server.type || 'stdio',
      toolCount: 0, // Would need runtime inspection
      estimatedTokensPerCall: estimateTokenCost(name),
    };
    servers.push(info);
  }

  const totalTools = servers.reduce((s, sv) => s + sv.toolCount, 0);
  const estimatedCost = servers.reduce((s, sv) => s + sv.estimatedTokensPerCall, 0);

  // Generate recommendations
  if (servers.length > 5) {
    recommendations.push(`${servers.length} MCP servers active. Consider disabling unused ones to reduce context overhead.`);
  }

  const heavyServers = servers.filter(s => s.estimatedTokensPerCall > 500);
  if (heavyServers.length > 0) {
    recommendations.push(`Heavy servers: ${heavyServers.map(s => s.name).join(', ')}. Each call uses ~500+ tokens.`);
  }

  return { servers, totalTools, estimatedContextCost: estimatedCost, recommendations };
}

export function formatReport(report: McpReport): string {
  const lines = [
    '# MCP Servers',
    '',
    `Active: ${report.servers.length}`,
    `Estimated context cost per cycle: ~${report.estimatedContextCost} tokens`,
    '',
    '## Servers',
    ...report.servers.map(s =>
      `  ${s.name.padEnd(25)} ${s.command} ${s.args.join(' ')}`.trimEnd()
    ),
  ];

  if (report.recommendations.length) {
    lines.push('', '## Recommendations');
    lines.push(...report.recommendations.map(r => `  - ${r}`));
  }

  return lines.join('\n');
}

function estimateTokenCost(name: string): number {
  // Rough estimates based on typical MCP server tool definitions
  const heavy = ['supabase', 'notion', 'hostinger', 'figma'];
  const medium = ['github', 'netlify', 'vercel', 'elevenlabs'];
  const light = ['logica-context', 'context-mode', 'instant-domain-search'];

  const lower = name.toLowerCase();
  if (heavy.some(h => lower.includes(h))) return 800;
  if (medium.some(m => lower.includes(m))) return 400;
  if (light.some(l => lower.includes(l))) return 150;
  return 300;
}
