// project-dna.ts — Scans project structure and creates an indexed "DNA" profile
// Auto-detects stack, dependencies, patterns, and key files

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

export interface ProjectDNA {
  name: string;
  root: string;
  stack: string[];
  languages: Record<string, number>;
  frameworks: string[];
  dependencies: string[];
  structure: string;
  keyFiles: string[];
  patterns: string[];
  summary: string;
}

const MAX_DEPTH = 4;
const IGNORE = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', '.cache',
  '__pycache__', '.venv', 'venv', '.tox', 'target', '.logica-context',
  'coverage', '.nyc_output', '.turbo', '.vercel', '.netlify',
]);

const LANG_MAP: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript/React', '.js': 'JavaScript',
  '.jsx': 'JavaScript/React', '.py': 'Python', '.go': 'Go',
  '.rs': 'Rust', '.rb': 'Ruby', '.swift': 'Swift', '.kt': 'Kotlin',
  '.java': 'Java', '.php': 'PHP', '.cs': 'C#', '.cpp': 'C++',
  '.c': 'C', '.lua': 'Lua', '.sh': 'Shell', '.sql': 'SQL',
  '.vue': 'Vue', '.svelte': 'Svelte', '.dart': 'Dart',
};

export function scanProject(root: string): ProjectDNA {
  const languages: Record<string, number> = {};
  const keyFiles: string[] = [];
  const allDirs: string[] = [];
  let fileCount = 0;

  // Walk directory tree
  function walk(dir: string, depth: number, relative: string) {
    if (depth > MAX_DEPTH) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      if (IGNORE.has(entry.name) || entry.name.startsWith('.')) continue;

      const fullPath = join(dir, entry.name);
      const relPath = relative ? `${relative}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        allDirs.push(relPath);
        walk(fullPath, depth + 1, relPath);
      } else {
        fileCount++;
        const ext = extname(entry.name).toLowerCase();
        if (LANG_MAP[ext]) {
          languages[LANG_MAP[ext]] = (languages[LANG_MAP[ext]] || 0) + 1;
        }
      }
    }
  }

  walk(root, 0, '');

  // Detect key files
  const keyFileNames = [
    'package.json', 'tsconfig.json', 'Cargo.toml', 'go.mod', 'pyproject.toml',
    'Gemfile', 'Makefile', 'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
    '.env.example', 'README.md', 'CLAUDE.md', '.mcp.json',
  ];
  for (const f of keyFileNames) {
    if (existsSync(join(root, f))) keyFiles.push(f);
  }

  // Detect stack
  const stack: string[] = [];
  const frameworks: string[] = [];
  const deps: string[] = [];

  // Node.js ecosystem
  const pkgPath = join(root, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      stack.push('Node.js');
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      deps.push(...Object.keys(allDeps).slice(0, 30));

      if (allDeps['react']) frameworks.push('React');
      if (allDeps['next']) frameworks.push('Next.js');
      if (allDeps['vue']) frameworks.push('Vue');
      if (allDeps['svelte']) frameworks.push('Svelte');
      if (allDeps['express']) frameworks.push('Express');
      if (allDeps['fastify']) frameworks.push('Fastify');
      if (allDeps['tailwindcss']) frameworks.push('Tailwind CSS');
      if (allDeps['prisma'] || allDeps['@prisma/client']) frameworks.push('Prisma');
      if (allDeps['drizzle-orm']) frameworks.push('Drizzle');
      if (allDeps['@supabase/supabase-js']) frameworks.push('Supabase');
      if (allDeps['vite']) frameworks.push('Vite');
      if (allDeps['esbuild']) frameworks.push('esbuild');
      if (allDeps['vitest']) frameworks.push('Vitest');
      if (allDeps['jest']) frameworks.push('Jest');
    } catch {}
  }

  // Python
  if (existsSync(join(root, 'pyproject.toml')) || existsSync(join(root, 'requirements.txt'))) {
    stack.push('Python');
  }

  // Go
  if (existsSync(join(root, 'go.mod'))) stack.push('Go');

  // Rust
  if (existsSync(join(root, 'Cargo.toml'))) stack.push('Rust');

  // Docker
  if (existsSync(join(root, 'Dockerfile'))) stack.push('Docker');

  // Detect patterns
  const patterns: string[] = [];
  if (allDirs.includes('src')) patterns.push('src/ directory');
  if (allDirs.includes('tests') || allDirs.includes('test') || allDirs.includes('__tests__')) patterns.push('test suite');
  if (allDirs.includes('src/components')) patterns.push('component-based');
  if (allDirs.includes('src/pages') || allDirs.includes('app')) patterns.push('page-based routing');
  if (allDirs.includes('src/api') || allDirs.includes('api')) patterns.push('API layer');
  if (existsSync(join(root, '.github/workflows'))) patterns.push('CI/CD (GitHub Actions)');
  if (existsSync(join(root, 'Makefile'))) patterns.push('Makefile build');

  // Build structure tree (top 2 levels)
  const structureLines = allDirs
    .filter(d => !d.includes('/') || d.split('/').length <= 2)
    .slice(0, 30)
    .map(d => `  ${d}/`);

  const name = basename(root);
  const topLang = Object.entries(languages).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const summary = [
    `${name}: ${stack.join(', ') || 'Unknown'} project`,
    `${fileCount} files, ${allDirs.length} directories`,
    `Languages: ${topLang.map(([l, c]) => `${l} (${c})`).join(', ')}`,
    frameworks.length ? `Frameworks: ${frameworks.join(', ')}` : '',
    patterns.length ? `Patterns: ${patterns.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  return {
    name,
    root,
    stack,
    languages,
    frameworks,
    dependencies: deps,
    structure: structureLines.join('\n'),
    keyFiles,
    patterns,
    summary,
  };
}
