// snapshot-builder.ts — Builds priority-tiered XML snapshot for session continuity
// When Claude Code compresses the conversation, this snapshot preserves the most
// important context so the AI can resume without losing track of what happened.

import { SessionStore, SessionEvent } from './session-store.js';

interface SnapshotTier {
  priority: number;
  label: string;
  content: string;
}

const MAX_SNAPSHOT_SIZE = 2048; // ~2KB target

export function buildSnapshot(sessionId: string, store: SessionStore): string {
  const events = store.getSessionEvents(sessionId, 100);
  if (events.length === 0) return '';

  const tiers: SnapshotTier[] = [];

  // Tier 1 (highest) — Session identity + key stats
  const summary = store.getSessionSummary(sessionId);
  if (summary) {
    tiers.push({
      priority: 1,
      label: 'session-identity',
      content: [
        `session: ${summary.session_id}`,
        `events: ${summary.total_events}`,
        `tools: ${summary.tools_used.join(', ')}`,
        `tokens_saved: ${summary.total_tokens_saved}`,
        `duration: ${summary.first_event} → ${summary.last_event}`,
      ].join('\n'),
    });
  }

  // Tier 2 — Recent file edits and writes (most impactful)
  const editEvents = events.filter(e =>
    ['Edit', 'Write', 'NotebookEdit'].includes(e.tool_name)
  );
  if (editEvents.length > 0) {
    tiers.push({
      priority: 2,
      label: 'files-modified',
      content: editEvents.slice(0, 10).map(e =>
        `${e.tool_name}: ${e.tool_input_summary}`
      ).join('\n'),
    });
  }

  // Tier 3 — Recent bash commands (context about what was tried)
  const bashEvents = events.filter(e => e.tool_name === 'Bash');
  if (bashEvents.length > 0) {
    tiers.push({
      priority: 3,
      label: 'commands-run',
      content: bashEvents.slice(0, 8).map(e =>
        `$ ${e.tool_input_summary} → ${e.tool_output_summary.slice(0, 80)}`
      ).join('\n'),
    });
  }

  // Tier 4 — Search and read operations (what was explored)
  const readEvents = events.filter(e =>
    ['Read', 'Grep', 'Glob'].includes(e.tool_name)
  );
  if (readEvents.length > 0) {
    tiers.push({
      priority: 4,
      label: 'files-explored',
      content: readEvents.slice(0, 8).map(e =>
        `${e.tool_name}: ${e.tool_input_summary}`
      ).join('\n'),
    });
  }

  // Tier 5 — Logica Context operations (what was indexed)
  const lctxEvents = events.filter(e => e.tool_name.startsWith('lctx_'));
  if (lctxEvents.length > 0) {
    tiers.push({
      priority: 5,
      label: 'context-operations',
      content: lctxEvents.slice(0, 5).map(e =>
        `${e.tool_name}: ${e.tool_input_summary}`
      ).join('\n'),
    });
  }

  // Build XML, fitting within MAX_SNAPSHOT_SIZE
  return buildXml(tiers);
}

function buildXml(tiers: SnapshotTier[]): string {
  // Sort by priority (1 = highest)
  tiers.sort((a, b) => a.priority - b.priority);

  let xml = '<session-snapshot>\n';
  let remaining = MAX_SNAPSHOT_SIZE - 40; // account for wrapper tags

  for (const tier of tiers) {
    const tierXml = `  <${tier.label} priority="${tier.priority}">\n    ${tier.content.replace(/\n/g, '\n    ')}\n  </${tier.label}>\n`;

    if (tierXml.length <= remaining) {
      xml += tierXml;
      remaining -= tierXml.length;
    } else if (remaining > 100) {
      // Truncate this tier to fit
      const availContent = remaining - tier.label.length * 2 - 40;
      if (availContent > 50) {
        const truncated = tier.content.slice(0, availContent) + '...';
        xml += `  <${tier.label} priority="${tier.priority}" truncated="true">\n    ${truncated.replace(/\n/g, '\n    ')}\n  </${tier.label}>\n`;
      }
      break;
    } else {
      break;
    }
  }

  xml += '</session-snapshot>';
  return xml;
}

export function injectSnapshot(store: SessionStore, sessionId?: string): string {
  // Try specific session, fall back to latest
  let snapshot: string | null = null;

  if (sessionId) {
    snapshot = store.getLatestSnapshot(sessionId);
  }

  if (!snapshot) {
    snapshot = store.getLatestSnapshotAnySession();
  }

  if (!snapshot) return '';

  return `<session-continuity>\n${snapshot}\n</session-continuity>`;
}
