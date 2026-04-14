// exit-classify.ts — Classifies exit codes for better error recovery

export interface ExitClassification {
  code: number;
  category: 'success' | 'error' | 'timeout' | 'permission' | 'not_found' | 'signal' | 'unknown';
  recoverable: boolean;
  suggestion?: string;
}

export function classifyExit(code: number, stderr = ''): ExitClassification {
  if (code === 0) {
    return { code, category: 'success', recoverable: true };
  }

  // Permission denied
  if (code === 1 && /permission denied|EACCES/i.test(stderr)) {
    return {
      code, category: 'permission', recoverable: true,
      suggestion: 'Check file permissions or run with appropriate access',
    };
  }

  // Command not found
  if (code === 127) {
    return {
      code, category: 'not_found', recoverable: true,
      suggestion: 'Command not found. Check if the tool is installed',
    };
  }

  // Timeout (exit 124 from timeout command, or custom)
  if (code === 124 || /timeout|ETIMEDOUT/i.test(stderr)) {
    return {
      code, category: 'timeout', recoverable: true,
      suggestion: 'Command timed out. Try with a longer timeout or simpler query',
    };
  }

  // Killed by signal (128+N)
  if (code > 128 && code < 160) {
    const signal = code - 128;
    const signalNames: Record<number, string> = {
      2: 'SIGINT', 6: 'SIGABRT', 9: 'SIGKILL', 11: 'SIGSEGV',
      13: 'SIGPIPE', 14: 'SIGALRM', 15: 'SIGTERM',
    };
    return {
      code, category: 'signal', recoverable: signal !== 9,
      suggestion: `Killed by ${signalNames[signal] || `signal ${signal}`}`,
    };
  }

  // OOM
  if (/out of memory|ENOMEM|heap/i.test(stderr)) {
    return {
      code, category: 'error', recoverable: true,
      suggestion: 'Out of memory. Try processing less data or use streaming',
    };
  }

  // Generic error
  return {
    code, category: 'error', recoverable: true,
    suggestion: stderr.slice(0, 200) || 'Unknown error',
  };
}
