// security.ts — Sandbox security restrictions
// Validates commands and paths before execution to prevent dangerous operations

import { resolve, normalize } from 'node:path';
import { homedir } from 'node:os';

// Commands that should never be executed in sandbox
const BLOCKED_COMMANDS = [
  /\brm\s+-rf\s+[\/~]/,         // rm -rf from root or home
  /\bsudo\b/,                    // no sudo
  /\bmkfs\b/,                    // no filesystem formatting
  /\bdd\s+if=/,                  // no disk operations
  /\bchmod\s+777/,               // no world-writable
  /\bcurl.*\|\s*sh/,             // no pipe-to-shell
  /\bwget.*\|\s*sh/,
  /\beval\s*\(/,                 // no eval in shell
  /\b(reboot|shutdown|halt)\b/,  // no system control
  />\s*\/etc\//,                 // no writing to /etc
  />\s*\/usr\//,                 // no writing to /usr
];

// Paths that sandbox should never access
const BLOCKED_PATHS = [
  '/etc/passwd',
  '/etc/shadow',
  '/etc/sudoers',
  '.ssh/id_rsa',
  '.ssh/id_ed25519',
  '.gnupg/',
  '.aws/credentials',
  '.env',
];

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
}

export function validateCommand(command: string): SecurityCheckResult {
  for (const pattern of BLOCKED_COMMANDS) {
    if (pattern.test(command)) {
      return {
        allowed: false,
        reason: `Blocked dangerous command pattern: ${pattern.source}`,
      };
    }
  }

  return { allowed: true };
}

export function validatePath(filePath: string): SecurityCheckResult {
  const normalized = normalize(resolve(filePath));
  const home = homedir();

  for (const blocked of BLOCKED_PATHS) {
    const fullBlocked = blocked.startsWith('/')
      ? blocked
      : resolve(home, blocked);

    if (normalized.startsWith(fullBlocked) || normalized === fullBlocked) {
      return {
        allowed: false,
        reason: `Access to ${blocked} is blocked for security`,
      };
    }
  }

  // Block paths outside home directory and /tmp
  if (!normalized.startsWith(home) && !normalized.startsWith('/tmp') && !normalized.startsWith('/var/folders')) {
    return {
      allowed: false,
      reason: `Path ${normalized} is outside allowed directories (home, /tmp)`,
    };
  }

  return { allowed: true };
}

export function sanitizeOutput(output: string): string {
  // Redact potential secrets from output
  let sanitized = output;

  // API keys / tokens
  sanitized = sanitized.replace(/(api[_-]?key|token|secret|password|credential)\s*[:=]\s*['"]?([^\s'"]{8,})/gi,
    (_, label) => `${label}=***REDACTED***`
  );

  // AWS keys
  sanitized = sanitized.replace(/AKIA[0-9A-Z]{16}/g, 'AKIA***REDACTED***');

  // Private keys
  sanitized = sanitized.replace(/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    '***PRIVATE KEY REDACTED***'
  );

  return sanitized;
}
