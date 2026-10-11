import {FunctionDesc, PropDesc} from '@ticlo/core';
import {getDescLib} from '../util/FunctionLib.ts';

interface HistoryEntry {
  name: string;
  count: number;
}

export class OptionalPropertyHistory {
  // Entries are stored from most to least recently used.
  entries: HistoryEntry[] = [];
  storageKey: string;
  storageAvailable = true;

  constructor(
    desc: FunctionDesc,
    private properties: {[key: string]: PropDesc},
    funcLib?: string
  ) {
    this.storageKey = `ticlo-optional-property-history:${JSON.stringify([
      getDescLib(desc.id, funcLib),
      desc.id ?? `${desc.ns ?? ''}:${desc.name}`,
    ])}`;
    this.load();
    if (!this.entries.length) {
      this.entries = [...new Set(desc.optionalSuggestions ?? [])]
        .filter((name) => Object.hasOwn(properties, name))
        .slice(0, 10)
        .map((name) => ({name, count: 1}));
      this.save();
    }
  }

  load() {
    if (!this.storageAvailable) return;
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(this.storageKey));
      if (Array.isArray(saved)) {
        const names = new Set<string>();
        this.entries = saved
          .filter((entry) => {
            if (
              !entry ||
              typeof entry.name !== 'string' ||
              !Object.hasOwn(this.properties, entry.name) ||
              !Number.isSafeInteger(entry.count) ||
              entry.count < 1 ||
              names.has(entry.name)
            ) {
              return false;
            }
            names.add(entry.name);
            return true;
          })
          .slice(0, 32);
      }
    } catch {
      // History remains usable in memory if browser storage is unavailable.
    }
  }

  save() {
    if (!this.storageAvailable) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
    } catch {
      // Enabling properties must also work when browser storage is unavailable.
      this.storageAvailable = false;
    }
  }

  record(name: string) {
    this.load();
    const index = this.entries.findIndex((entry) => entry.name === name);
    const count = index < 0 ? 1 : this.entries.splice(index, 1)[0].count + 1;
    this.entries.unshift({name, count});
    if (this.entries.length > 32) {
      let evict = 10;
      for (let i = 11; i < this.entries.length; ++i) {
        if (this.entries[i].count <= this.entries[evict].count) evict = i;
      }
      this.entries.splice(evict, 1);
    }
    this.save();
  }

  getSuggestions(): string[] {
    this.load();
    const recent = this.entries.slice(0, 5);
    const frequent = this.entries
      .slice(5)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return [...recent, ...frequent].map((entry) => entry.name);
  }
}
