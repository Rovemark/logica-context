import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionStore } from '../src/session-store';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('SessionStore', () => {
  let store: SessionStore;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'lctx-session-test-'));
    store = new SessionStore(tmpDir);
  });

  afterEach(() => {
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should record and retrieve events', () => {
    store.recordEvent({
      session_id: 'test-session',
      tool_name: 'Bash',
      tool_input_summary: 'git status',
      tool_output_summary: 'On branch main',
      tokens_saved: 50,
    });

    const events = store.getSessionEvents('test-session');
    expect(events.length).toBe(1);
    expect(events[0].tool_name).toBe('Bash');
  });

  it('should generate session summary', () => {
    store.recordEvent({
      session_id: 's1',
      tool_name: 'Bash',
      tool_input_summary: 'ls',
      tool_output_summary: 'files...',
      tokens_saved: 100,
    });
    store.recordEvent({
      session_id: 's1',
      tool_name: 'Read',
      tool_input_summary: 'file.ts',
      tool_output_summary: 'code...',
      tokens_saved: 200,
    });

    const summary = store.getSessionSummary('s1');
    expect(summary).not.toBeNull();
    expect(summary!.total_events).toBe(2);
    expect(summary!.tools_used).toContain('Bash');
    expect(summary!.tools_used).toContain('Read');
    expect(summary!.total_tokens_saved).toBe(300);
  });

  it('should save and retrieve snapshots', () => {
    store.saveSnapshot('s1', '<snapshot>test</snapshot>');
    const snap = store.getLatestSnapshot('s1');
    expect(snap).toBe('<snapshot>test</snapshot>');
  });

  it('should get latest snapshot from any session', () => {
    store.saveSnapshot('s1', '<old/>');
    store.saveSnapshot('s2', '<new/>');
    const snap = store.getLatestSnapshotAnySession();
    expect(snap).toBe('<new/>');
  });
});
