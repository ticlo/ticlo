import {Root} from '../../block/Flow.ts';
import {makeLocalConnection} from '../LocalConnection.ts';
import {expect, vi} from 'vitest';
import {queryBlock} from '../Query.ts';

describe('Query', function () {
  beforeAll(function () {
    const flow = Root.instance.addFlow('QueryData');
    flow.load({
      a: {
        '#is': '',
        'c': {'#is': '', 'v': 1, 'b': false},
        'd': {'#is': '', 'v': 2, 'b': true},
        'e': {'#is': '', 'v': 3, 'b': false},
        'f': {'#is': '', 'v': 4, 'b': true},
      },
      b: {
        '#is': '',
      },
      va: 'v1',
      vb: 'v2',
      vc: 'v3',
      vd: 'v4',
    });
  });
  afterAll(function () {
    Root.instance.deleteValue('QueryData');
  });
  it('basic', async function () {
    const [server, client] = makeLocalConnection(Root.instance, false);

    let result = await client.query('QueryData', {'?values': ['va']});
    expect(result.value).toEqual({va: 'v1'});

    result = await client.query('QueryData', {'?values': ['/v[cde]/']});
    expect(result.value).toEqual({vc: 'v3', vd: 'v4'});

    result = await client.query('QueryData', {a: {c: {}}});
    expect(result.value).toEqual({a: {c: {}}});

    result = await client.query('QueryData', {a: {'/[efg]/': {}}});
    expect(result.value).toEqual({a: {e: {}, f: {}}});
    // clean up
    client.destroy();
  });
  it('filter', async function () {
    const [server, client] = makeLocalConnection(Root.instance, false);

    let result = await client.query('QueryData', {
      a: {'/.*/': {'?values': ['#is', 'b'], '?filter': {type: '=', field: 'v', value: 3}}},
    });
    expect(result.value).toEqual({a: {e: {'#is': '', 'b': false}}});

    result = await client.query('QueryData', {
      a: {'/.*/': {'?filter': {type: '!=', field: 'v', value: 3}}},
    });
    expect(result.value).toEqual({a: {c: {}, d: {}, f: {}}});

    result = await client.query('QueryData', {
      a: {'/.*/': {'?filter': {type: '>', field: 'v', value: 3}}},
    });
    expect(result.value).toEqual({a: {f: {}}});

    result = await client.query('QueryData', {
      a: {'/.*/': {'?filter': {type: '<', field: 'v', value: 3}}},
    });
    expect(result.value).toEqual({a: {c: {}, d: {}}});

    result = await client.query('QueryData', {
      a: {'/.*/': {'?filter': {type: '>=', field: 'v', value: 3}}},
    });
    expect(result.value).toEqual({a: {e: {}, f: {}}});

    result = await client.query('QueryData', {
      a: {'/.*/': {'?filter': {type: '<=', field: 'v', value: 3}}},
    });
    expect(result.value).toEqual({a: {c: {}, d: {}, e: {}}});

    result = await client.query('QueryData', {
      a: {'/.*/': {'?filter': {field: 'b'}}}, // not filter type, directly cast field to boolean
    });
    expect(result.value).toEqual({a: {d: {}, f: {}}});

    result = await client.query('QueryData', {
      a: {'/.*/': {'?filter': {type: 'in', field: 'v', value: [1, 3, 4]}}},
    });
    expect(result.value).toEqual({a: {c: {}, e: {}, f: {}}});

    result = await client.query('QueryData', {
      a: {'/.*/': {'?filter': {type: 'match', field: 'v', value: '/[12]/'}}},
    });
    expect(result.value).toEqual({a: {c: {}, d: {}}});

    result = await client.query('QueryData', {
      a: {
        '/.*/': {
          '?filter': {
            type: 'all',
            value: [
              {type: '<=', field: 'v', value: 3},
              {type: '!=', field: 'b', value: true},
            ],
          },
        },
      },
    });
    expect(result.value).toEqual({a: {c: {}, e: {}}});

    result = await client.query('QueryData', {
      a: {
        '/.*/': {
          '?filter': {
            type: 'any',
            value: [
              {type: '<', field: 'v', value: 2},
              {type: '=', field: 'b', value: true},
            ],
          },
        },
      },
    });
    expect(result.value).toEqual({a: {c: {}, d: {}, f: {}}});

    // clean up
    client.destroy();
  });

  it('skips external references before evaluating their values or filters', () => {
    const root = new Root();
    const otherRoot = new Root();
    try {
      const main = root.addFlow('Main', {value: 1});
      const outside = root.addFlow('Other', {value: 2});
      const samePath = otherRoot.addFlow('Main').createBlock('child');
      main.setValue('outside', outside);
      main.setValue('otherRoot', samePath);
      const readOutside = vi.spyOn(outside, 'getValue');
      const readOtherRoot = vi.spyOn(samePath, 'getValue');
      const query = {'?filter': {field: 'value', type: '=' as const, value: 2}, '?values': ['value']};

      expect(queryBlock(main, {'outside': query, 'otherRoot': query, '##': {Other: query}})).toEqual({});
      expect(queryBlock(main, {'/outside|otherRoot/': query})).toEqual({});
      expect(readOutside).not.toHaveBeenCalled();
      expect(readOtherRoot).not.toHaveBeenCalled();
    } finally {
      root.destroy();
      otherRoot.destroy();
    }
  });

  it('keeps the original boundary through internal references and parent links', () => {
    const root = new Root();
    try {
      const main = root.addFlow('Main', {value: 1});
      const child = main.createBlock('child');
      child.setValue('value', 2);
      const nested = child.createBlock('nested');
      nested.setValue('value', 3);
      main.setValue('alias', nested);
      child.setValue('self', child);
      const values = {'?values': ['value']};

      expect(queryBlock(main, {alias: values, child: {'nested': values, '##': values}})).toEqual({
        alias: {value: 3},
        child: {'nested': {value: 3}, '##': {value: 1}},
      });
      expect(queryBlock(main, {'/alias/': values})).toEqual({alias: {value: 3}});
      expect(queryBlock(child, {'##': values, '#flow': values, 'self': values, 'nested': {'##': values}})).toEqual({
        self: {value: 2},
        nested: {'##': {value: 2}},
      });
      expect(queryBlock(child, {nested: {'##': {'##': values}}})).toEqual({nested: {'##': {}}});
    } finally {
      root.destroy();
    }
  });
});
