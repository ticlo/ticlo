import {Root} from '../../block/Flow';
import {makeLocalConnection} from '../LocalConnection';
import {AsyncClientPromise} from './AsyncClientPromise';
import {expect} from 'vitest';
import {isDataTruncated} from '../../util/DataTypes';

describe('Query', function () {
  beforeAll(function () {
    let flow = Root.instance.addFlow('QueryData');
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
    let [server, client] = makeLocalConnection(Root.instance, false);

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
    let [server, client] = makeLocalConnection(Root.instance, false);

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
});
