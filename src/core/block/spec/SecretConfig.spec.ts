import {BlockFunction, PureFunction} from '../BlockFunction';
import {Block, setSecretCipher} from '../Block';
import {Functions} from '../Functions';
import {Flow, Root} from '../Flow';
import {expect} from 'vitest';

export class TestSecretFunction extends BlockFunction {
  run() {
    const secret = this._data._getSecret(this);
    this._data.output(secret);
  }
  cleanup(): void {
    this._data._setSecret(undefined);
  }
}

Functions.add(TestSecretFunction, {name: 'test-secret'}, null);

describe('Secret Property', function () {
  it('set and read secret', function () {
    let flow = new Flow();
    let aBlock = flow.createBlock('a');
    aBlock._load({'#is': 'test-secret'});
    aBlock.setValue('#secret', 'abc123');
    aBlock.setBinding('a', '#secret');
    aBlock.setBinding('#secret', '#is');
    Root.run();
    expect(aBlock.getValue('#secret')).toBeUndefined(); // #secret is not readable
    expect(aBlock.getProperty('#secret')._bindingPath).toBeUndefined(); // can not bind to #secret
    expect(aBlock.getValue('a')).toBeUndefined(); // #secret can not be bound from
    expect(aBlock.getValue('#output')).toBe('abc123');
  });
  it('save and load secret', function () {
    const codec1 = {
      decode(data: unknown): string {
        if (typeof data === 'string') {
          return data.substring(1);
        }
        return undefined;
      },
      encode(str: string): unknown {
        if (str) {
          return `1${str}`;
        }
        return undefined;
      },
    };
    const codec2 = {
      decode(data: unknown): string {
        if (typeof data === 'string') {
          return data.substring(2);
        }
        return undefined;
      },
      encode(str: string): unknown {
        if (str) {
          return `22${str}`;
        }
        return undefined;
      },
    };
    setSecretCipher(codec1);
    let flow = new Flow();
    let aBlock = flow.createBlock('a');
    aBlock._load({'#is': 'test-secret', '#secret': '1abc'});
    Root.run();
    expect(aBlock.getValue('#output')).toBe('abc');
    expect(aBlock._save()).toEqual({'#is': 'test-secret', '#secret': '1abc'});
    setSecretCipher(codec2);
    expect(aBlock._save()).toEqual({'#is': 'test-secret', '#secret': '1abc'}); // codec should not change unless value is reset
    aBlock.setValue('#secret', undefined);
    aBlock.setValue('#secret', 'abc');
    expect(aBlock._save()).toEqual({'#is': 'test-secret', '#secret': '22abc'}); // codec should change after value is reset
  });
});
