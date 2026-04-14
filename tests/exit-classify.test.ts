import { describe, it, expect } from 'vitest';
import { classifyExit } from '../src/exit-classify';

describe('Exit Classify', () => {
  it('should classify exit 0 as success', () => {
    const result = classifyExit(0);
    expect(result.category).toBe('success');
  });

  it('should classify exit 127 as not_found', () => {
    const result = classifyExit(127);
    expect(result.category).toBe('not_found');
  });

  it('should classify exit 124 as timeout', () => {
    const result = classifyExit(124);
    expect(result.category).toBe('timeout');
  });

  it('should classify exit 137 as SIGKILL', () => {
    const result = classifyExit(137);
    expect(result.category).toBe('signal');
    expect(result.suggestion).toContain('SIGKILL');
  });

  it('should detect permission denied from stderr', () => {
    const result = classifyExit(1, 'Error: permission denied');
    expect(result.category).toBe('permission');
  });

  it('should detect OOM from stderr', () => {
    const result = classifyExit(1, 'FATAL ERROR: heap out of memory');
    expect(result.category).toBe('error');
    expect(result.suggestion).toContain('memory');
  });
});
