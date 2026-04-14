/**
 * Logica Context u2014 Sandboxed Execution Engine
 * Clean room implementation. MIT License.
 *
 * WHY: Running code directly in the Claude context dumps stdout/stderr into
 * the conversation, consuming tokens. Sandbox executes in a child process,
 * captures output, and returns only a summary u2014 saving context window space.
 *
 * MECHANISM:
 * - Spawns child process with timeout and resource limits
 * - Captures stdout + stderr
 * - Returns structured result (exit code, output, truncated if large)
 * - Optionally indexes output into knowledge base
 */

import { spawn, SpawnOptions } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { estimateTokens, truncate } from './utils.js';
import { validateCommand, sanitizeOutput } from './security.js';
import { classifyExit } from './exit-classify.js';

export interface ExecutionResult {
  exit_code: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
  execution_time_ms: number;
  tokens_in_output: number;
}

export interface ExecutionOptions {
  /** Shell to use (default: /bin/bash) */
  shell?: string;
  /** Working directory */
  cwd?: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Max output length in characters (default: 50000) */
  maxOutput?: number;
  /** Environment variables to add */
  env?: Record<string, string>;
  /** Language for file execution: shell, node, python */
  language?: 'shell' | 'node' | 'python';
}

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_OUTPUT = 50_000;
const SANDBOX_DIR = join(tmpdir(), 'logica-context-sandbox');

/**
 * Execute a command in a sandboxed child process.
 */
export function execute(command: string, options: ExecutionOptions = {}): Promise<ExecutionResult> {
  const {
    shell = '/bin/bash',
    cwd = SANDBOX_DIR,
    timeout = DEFAULT_TIMEOUT,
    maxOutput = DEFAULT_MAX_OUTPUT,
    env = {},
  } = options;

  // Security check
  const check = validateCommand(command);
  if (!check.allowed) {
    return Promise.resolve({
      exit_code: 1,
      stdout: '',
      stderr: `BLOCKED: ${check.reason}`,
      truncated: false,
      execution_time_ms: 0,
      tokens_in_output: 0,
    });
  }

  // Ensure sandbox directory exists
  if (!existsSync(cwd)) {
    mkdirSync(cwd, { recursive: true });
  }

  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let truncated = false;

    const spawnOptions: SpawnOptions = {
      shell,
      cwd,
      timeout,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    };

    const child = spawn(command, [], spawnOptions);

    child.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      if (stdout.length + chunk.length > maxOutput) {
        stdout += chunk.slice(0, maxOutput - stdout.length);
        truncated = true;
      } else {
        stdout += chunk;
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      if (stderr.length + chunk.length > maxOutput) {
        stderr += chunk.slice(0, maxOutput - stderr.length);
        truncated = true;
      } else {
        stderr += chunk;
      }
    });

    child.on('close', (code) => {
      const exitCode = code ?? 1;
      const classification = classifyExit(exitCode, stderr);
      resolve({
        exit_code: exitCode,
        stdout: sanitizeOutput(stdout.trim()),
        stderr: sanitizeOutput(stderr.trim()),
        truncated,
        execution_time_ms: Date.now() - startTime,
        tokens_in_output: estimateTokens(stdout + stderr),
        ...(classification.category !== 'success' && classification.suggestion
          ? { suggestion: classification.suggestion } : {}),
      });
    });

    child.on('error', (err) => {
      resolve({
        exit_code: 1,
        stdout: '',
        stderr: err.message,
        truncated: false,
        execution_time_ms: Date.now() - startTime,
        tokens_in_output: estimateTokens(err.message),
      });
    });
  });
}

/**
 * Execute a file in a sandboxed environment.
 * Writes content to temp file, executes, cleans up.
 */
export async function executeFile(
  content: string,
  language: 'shell' | 'node' | 'python' = 'shell',
  options: ExecutionOptions = {}
): Promise<ExecutionResult> {
  const extensions: Record<string, string> = {
    shell: '.sh',
    node: '.mjs',
    python: '.py',
  };

  const interpreters: Record<string, string> = {
    shell: '/bin/bash',
    node: 'node',
    python: 'python3',
  };

  // Ensure sandbox dir
  if (!existsSync(SANDBOX_DIR)) {
    mkdirSync(SANDBOX_DIR, { recursive: true });
  }

  const fileName = `lctx_${Date.now()}${extensions[language]}`;
  const filePath = join(SANDBOX_DIR, fileName);

  try {
    writeFileSync(filePath, content, 'utf-8');

    const command = language === 'shell'
      ? `bash "${filePath}"`
      : `${interpreters[language]} "${filePath}"`;

    return await execute(command, { ...options, cwd: options.cwd || SANDBOX_DIR });
  } finally {
    // Cleanup temp file
    try { unlinkSync(filePath); } catch { /* ignore */ }
  }
}

/**
 * Get the sandbox directory path.
 */
export function getSandboxDir(): string {
  return SANDBOX_DIR;
}
