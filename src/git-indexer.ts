// git-indexer.ts — Git-aware indexing: diffs, commits, branches
// Auto-indexes on session start so AI knows what changed recently

import { execute } from './sandbox.js';

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  untracked: string[];
  staged: string[];
  recentCommits: GitCommit[];
  diff: string;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export async function getGitStatus(cwd?: string): Promise<GitStatus | null> {
  const dir = cwd || process.cwd();

  // Check if git repo
  const check = await execute('git rev-parse --is-inside-work-tree', { cwd: dir, timeout: 5000 });
  if (check.exit_code !== 0) return null;

  // Get branch info
  const branchResult = await execute('git branch --show-current', { cwd: dir, timeout: 5000 });
  const branch = branchResult.stdout.trim() || 'HEAD';

  // Ahead/behind
  const abResult = await execute('git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null || echo "0 0"', { cwd: dir, timeout: 5000 });
  const [ahead, behind] = abResult.stdout.trim().split(/\s+/).map(Number);

  // Status
  const statusResult = await execute('git status --porcelain', { cwd: dir, timeout: 5000 });
  const lines = statusResult.stdout.trim().split('\n').filter(Boolean);

  const modified: string[] = [];
  const untracked: string[] = [];
  const staged: string[] = [];

  for (const line of lines) {
    const status = line.slice(0, 2);
    const file = line.slice(3);
    if (status.includes('?')) untracked.push(file);
    else if (status[0] !== ' ') staged.push(file);
    else modified.push(file);
  }

  // Recent commits
  const logResult = await execute('git log --oneline -10 --format="%h|%s|%an|%ci"', { cwd: dir, timeout: 5000 });
  const recentCommits: GitCommit[] = logResult.stdout.trim().split('\n').filter(Boolean).map(line => {
    const [hash, message, author, date] = line.split('|');
    return { hash, message, author, date };
  });

  // Diff (staged + unstaged)
  const diffResult = await execute('git diff --stat HEAD 2>/dev/null || git diff --stat', { cwd: dir, timeout: 10000 });
  const diff = diffResult.stdout;

  return {
    branch,
    ahead: ahead || 0,
    behind: behind || 0,
    modified,
    untracked,
    staged,
    recentCommits,
    diff,
  };
}

export function formatGitStatus(status: GitStatus): string {
  const lines = [
    `# Git Status`,
    `Branch: ${status.branch}`,
    status.ahead ? `Ahead: ${status.ahead} commits` : '',
    status.behind ? `Behind: ${status.behind} commits` : '',
    '',
  ].filter(Boolean);

  if (status.staged.length) {
    lines.push(`## Staged (${status.staged.length})`);
    lines.push(...status.staged.slice(0, 15).map(f => `  + ${f}`));
  }

  if (status.modified.length) {
    lines.push(`## Modified (${status.modified.length})`);
    lines.push(...status.modified.slice(0, 15).map(f => `  ~ ${f}`));
  }

  if (status.untracked.length) {
    lines.push(`## Untracked (${status.untracked.length})`);
    lines.push(...status.untracked.slice(0, 10).map(f => `  ? ${f}`));
  }

  if (status.recentCommits.length) {
    lines.push('', '## Recent Commits');
    lines.push(...status.recentCommits.slice(0, 8).map(c => `  ${c.hash} ${c.message}`));
  }

  if (status.diff) {
    lines.push('', '## Diff Summary', status.diff.slice(0, 500));
  }

  return lines.join('\n');
}
