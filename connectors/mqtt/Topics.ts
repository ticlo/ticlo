import type {LivePage, LivePageRequest, LiveRow} from '@ticlo/core';

function validName(value: string) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    Buffer.byteLength(value) <= 65535 &&
    !value.includes('\0') &&
    value.isWellFormed()
  );
}

export function validateTopic(topic: string) {
  if (!validName(topic) || /[+#]/.test(topic)) throw new Error('Invalid MQTT topic');
}

export function topicFilter(filter: string): (topic: string, levels?: string[]) => boolean {
  if (!validName(filter) || filter.startsWith('$share/')) throw new Error('Invalid MQTT topic filter');
  const parts = filter.split('/');
  if (
    parts.some(
      (part, index) =>
        (part.includes('+') && part !== '+') || (part.includes('#') && (part !== '#' || index !== parts.length - 1))
    )
  )
    throw new Error('Invalid MQTT topic filter');
  if (!/[+#]/.test(filter)) return (topic) => topic === filter;
  const system = filter.startsWith('$');
  return (topic, levels = topic.split('/')) => {
    if (!system && topic.startsWith('$')) return false;
    for (let i = 0; i < parts.length; ++i) {
      if (parts[i] === '#') return true;
      if (i >= levels.length || (parts[i] !== '+' && parts[i] !== levels[i])) return false;
    }
    return parts.length === levels.length;
  };
}

const MAX_TOPICS = 4096;
const TOPIC_TTL = 60 * 60_000;

export class TopicIndex {
  private rows = new Map<string, LiveRow>();

  observe(topic: string, preview: string, observedAt: number) {
    if (topic.length > 4096) return;
    this.rows.delete(topic);
    this.rows.set(topic, {id: topic, label: topic, target: topic, observedAt, preview});
    if (this.rows.size > MAX_TOPICS) this.rows.delete(this.rows.keys().next().value);
  }

  get(topic: string) {
    this.expire();
    return this.rows.get(topic);
  }

  private expire() {
    const cutoff = Date.now() - TOPIC_TTL;
    for (const [topic, row] of this.rows) {
      if (row.observedAt >= cutoff) break;
      this.rows.delete(topic);
    }
  }

  search(filter: string, page: LivePageRequest): LivePage {
    const matches = filter ? topicFilter(filter) : () => true;
    this.expire();
    return toPage(
      [...this.rows.values()].filter((row) => matches(row.id)),
      page
    );
  }

  listChildren(parent: string | undefined, page: LivePageRequest): LivePage {
    this.expire();
    const children = new Map<string, LiveRow>();
    const prefix = parent === undefined ? '' : parent + '/';
    for (const topic of this.rows.keys()) {
      if (!topic.startsWith(prefix)) continue;
      const remainder = topic.slice(prefix.length);
      const depth = remainder.indexOf('/');
      const label = depth < 0 ? remainder : remainder.slice(0, depth);
      const id = prefix + label;
      let child = children.get(id);
      if (!child) {
        child = {...(this.rows.get(id) ?? {id}), label};
        children.set(id, child);
      }
      if (depth >= 0) child.branch = id;
    }
    return toPage([...children.values()], page);
  }
}

function toPage(rows: LiveRow[], {limit, cursor}: LivePageRequest): LivePage {
  rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const start = cursor === undefined ? 0 : rows.findIndex((row) => row.id > cursor);
  if (start < 0) return {rows: []};
  const result = rows.slice(start, start + limit);
  return {rows: result, cursor: start + limit < rows.length ? result.at(-1).id : undefined};
}
