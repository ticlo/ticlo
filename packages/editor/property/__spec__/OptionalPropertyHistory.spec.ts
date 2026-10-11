import {FunctionDesc, PropDesc} from '@ticlo/core';
import {OptionalPropertyHistory} from '../OptionalPropertyHistory.ts';

describe('OptionalPropertyHistory', () => {
  const desc: FunctionDesc = {name: 'history-test', id: 'test:optional-history'};
  const properties: {[key: string]: PropDesc} = Object.fromEntries(
    Array.from({length: 40}, (_, i) => [`p${i}`, {name: `p${i}`, type: 'string'}])
  );
  let history: OptionalPropertyHistory;
  const keys = new Set<string>();
  const createHistory = (funcDesc = desc, funcLib?: string) => {
    const result = new OptionalPropertyHistory(funcDesc, properties, funcLib);
    keys.add(result.storageKey);
    return result;
  };

  beforeEach(() => {
    history = createHistory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of keys) localStorage.removeItem(key);
    keys.clear();
  });

  it('seeds at most ten valid, unique suggestions with one use, only when history is empty', () => {
    const optionalSuggestions = ['missing', 'p0', 'p0', ...Array.from({length: 12}, (_, i) => `p${i}`)];
    history = createHistory({...desc, optionalSuggestions});
    expect(history.entries).toEqual(Array.from({length: 10}, (_, i) => ({name: `p${i}`, count: 1})));
    expect(history.getSuggestions()).toEqual(Array.from({length: 10}, (_, i) => `p${i}`));

    history.record('p20');
    expect(createHistory({...desc, optionalSuggestions: ['p30']}).entries).toEqual(history.entries);
    expect(history.entries[0]).toEqual({name: 'p20', count: 1});
    history.record('p0');
    expect(history.entries[0]).toEqual({name: 'p0', count: 2});
  });

  it('shows five recent names followed by five distinct frequent names, breaking ties by recency', () => {
    history.record('p0');
    history.record('p0');
    history.record('p1');
    history.record('p1');
    history.record('p1');
    for (let i = 2; i < 14; ++i) history.record(`p${i}`);
    expect(history.getSuggestions()).toEqual(['p13', 'p12', 'p11', 'p10', 'p9', 'p1', 'p0', 'p8', 'p7', 'p6']);
    expect(history.entries.find((entry) => entry.name === 'p1').count).toBe(3);
  });

  it('evicts the least used name outside the ten most recent names, with oldest ties first', () => {
    history.record('p0');
    history.record('p0');
    history.record('p1');
    for (let i = 2; i < 23; ++i) {
      history.record(`p${i}`);
      history.record(`p${i}`);
    }
    for (let i = 23; i < 33; ++i) history.record(`p${i}`);
    expect(history.entries).toHaveLength(32);
    expect(history.entries.some((entry) => entry.name === 'p1')).toBe(false);
    expect(history.entries.some((entry) => entry.name === 'p0')).toBe(true);
    expect(history.entries.slice(0, 10).map((entry) => entry.name)).toEqual(
      Array.from({length: 10}, (_, i) => `p${32 - i}`)
    );

    history.record('p33');
    expect(history.entries.some((entry) => entry.name === 'p23')).toBe(false);
    expect(history.entries).toHaveLength(32);
  });

  it('persists usage and keeps function types and local libraries separate', () => {
    history.record('p0');
    history.record('p0');
    expect(createHistory().entries).toEqual([{name: 'p0', count: 2}]);
    expect(createHistory(desc, 'global-function-context').entries).toEqual(history.entries);
    expect(createHistory({...desc, id: 'test:other-optional-history'}).entries).toEqual([]);

    const localDesc = {...desc, id: ':optional-history'};
    createHistory(localDesc, 'libraryA').record('p1');
    expect(createHistory(localDesc, 'libraryA').getSuggestions()).toEqual(['p1']);
    expect(createHistory(localDesc, 'libraryB').entries).toEqual([]);
  });

  it('shares new uses across mounted property lists of the same type', () => {
    const other = createHistory();
    history.record('p0');
    other.record('p0');
    history.record('p1');
    expect(other.getSuggestions()).toEqual(['p1', 'p0']);
    expect(other.entries).toEqual([
      {name: 'p1', count: 1},
      {name: 'p0', count: 2},
    ]);
  });

  it('ignores invalid stored entries and seeds malformed history', () => {
    localStorage.setItem(
      history.storageKey,
      JSON.stringify([
        null,
        {name: 'missing', count: 2},
        {name: 'p0', count: 0},
        {name: 'p1', count: 1.5},
        {name: 'p2', count: 3},
        {name: 'p2', count: 1},
      ])
    );
    expect(createHistory().entries).toEqual([{name: 'p2', count: 3}]);
    localStorage.setItem(history.storageKey, '{');
    expect(createHistory({...desc, optionalSuggestions: ['p0']}).entries).toEqual([{name: 'p0', count: 1}]);
    expect(createHistory().entries).toEqual([{name: 'p0', count: 1}]);
  });

  it('keeps working in memory when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    history = createHistory({...desc, optionalSuggestions: ['p0']});
    history.record('p1');
    history.record('p0');
    expect(history.getSuggestions()).toEqual(['p0', 'p1']);
    expect(history.entries[0]).toEqual({name: 'p0', count: 2});
  });

  it('retains new usage in memory when localStorage reads succeed but writes fail', () => {
    history = createHistory({...desc, optionalSuggestions: ['p0']});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage full');
    });
    history.record('p1');
    history.record('p1');
    expect(history.getSuggestions()).toEqual(['p1', 'p0']);
    expect(history.entries[0]).toEqual({name: 'p1', count: 2});
  });
});
