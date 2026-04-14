// context-budget.ts — Tracks token consumption and shows budget status
// Warns when approaching context window limits

export interface BudgetEntry {
  tool: string;
  tokens_in: number;
  tokens_out: number;
  timestamp: number;
}

export interface BudgetReport {
  total_tokens_in: number;
  total_tokens_out: number;
  total_saved: number;
  budget_used_pct: number;
  entries: BudgetEntry[];
  warning: string | null;
}

const DEFAULT_CONTEXT_LIMIT = 200_000; // Claude default
const WARNING_THRESHOLD = 0.75; // 75%
const CRITICAL_THRESHOLD = 0.90; // 90%

export class ContextBudget {
  private entries: BudgetEntry[] = [];
  private contextLimit: number;

  constructor(contextLimit?: number) {
    this.contextLimit = contextLimit || parseInt(process.env.LCTX_CONTEXT_LIMIT || '') || DEFAULT_CONTEXT_LIMIT;
  }

  record(tool: string, tokensIn: number, tokensOut: number): void {
    this.entries.push({
      tool,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      timestamp: Date.now(),
    });
  }

  getReport(): BudgetReport {
    const totalIn = this.entries.reduce((s, e) => s + e.tokens_in, 0);
    const totalOut = this.entries.reduce((s, e) => s + e.tokens_out, 0);
    const totalSaved = this.entries.reduce((s, e) => s + Math.max(0, e.tokens_out - e.tokens_in), 0);
    const usedPct = totalIn / this.contextLimit;

    let warning: string | null = null;
    if (usedPct >= CRITICAL_THRESHOLD) {
      warning = `CRITICAL: Context ${Math.round(usedPct * 100)}% full. Consider purging or compacting.`;
    } else if (usedPct >= WARNING_THRESHOLD) {
      warning = `WARNING: Context ${Math.round(usedPct * 100)}% full. Use lctx tools to save space.`;
    }

    return {
      total_tokens_in: totalIn,
      total_tokens_out: totalOut,
      total_saved: totalSaved,
      budget_used_pct: Math.round(usedPct * 100),
      entries: this.entries.slice(-20), // last 20 entries
      warning,
    };
  }

  formatReport(): string {
    const report = this.getReport();
    const bar = this.renderBar(report.budget_used_pct);

    const lines = [
      '# Context Budget',
      '',
      `${bar} ${report.budget_used_pct}% used`,
      '',
      `Tokens consumed: ${report.total_tokens_in.toLocaleString()}`,
      `Tokens saved:    ${report.total_saved.toLocaleString()}`,
      `Context limit:   ${this.contextLimit.toLocaleString()}`,
      '',
      '## Recent Tool Usage',
      ...report.entries.slice(-10).map(e =>
        `  ${e.tool.padEnd(20)} in: ${e.tokens_in.toLocaleString().padStart(8)}  out: ${e.tokens_out.toLocaleString().padStart(8)}`
      ),
    ];

    if (report.warning) {
      lines.push('', `⚠ ${report.warning}`);
    }

    return lines.join('\n');
  }

  private renderBar(pct: number): string {
    const width = 20;
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    const char = pct >= 90 ? '█' : pct >= 75 ? '▓' : '░';
    return `[${char.repeat(filled)}${'·'.repeat(empty)}]`;
  }

  reset(): void {
    this.entries = [];
  }
}
