import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KnowledgeBase } from '../src/knowledge-base';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('KnowledgeBase', () => {
  let kb: KnowledgeBase;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'lctx-test-'));
    kb = new KnowledgeBase(tmpDir);
  });

  afterEach(() => {
    kb.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should index and search content', () => {
    kb.index('test-doc', 'Hello world this is a test document');
    const results = kb.search('hello world');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('test-doc');
  });

  it('should return empty for unmatched search', () => {
    kb.index('test-doc', 'Hello world');
    const results = kb.search('xyzzynotfound');
    expect(results.length).toBe(0);
  });

  it('should chunk large content', () => {
    const content = 'line\n'.repeat(2000);
    const chunks = kb.indexChunked('big-doc', content, 100);
    expect(chunks).toBeGreaterThan(1);
  });

  it('should upsert same source', () => {
    kb.index('doc1', 'first version');
    kb.index('doc1', 'second version');
    const results = kb.search('second version');
    expect(results.length).toBe(1);
    expect(results[0].content).toContain('second');
  });

  it('should report stats', () => {
    kb.index('a', 'content a');
    kb.index('b', 'content b');
    const stats = kb.stats();
    expect(stats.total_entries).toBe(2);
    expect(stats.total_sources).toBe(2);
    expect(stats.db_size_kb).toBeGreaterThan(0);
  });

  it('should purge all entries', () => {
    kb.index('a', 'content');
    kb.purge();
    expect(kb.stats().total_entries).toBe(0);
  });
});
