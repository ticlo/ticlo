import {expect} from 'vitest';
import * as i18n from '../i18n';
import i18next from 'i18next';

const beforeAll = globalThis.beforeAll ?? globalThis.before;

describe('i18n', function () {
  beforeAll(async function () {
    await i18n.init('en');
    i18next.addResourceBundle('en', 'ticlo-testi18n', {
      aaa: {
        '@name': 'AAA',
        'bbb': {
          '@name': 'BBB',
        },
      },
    });
  });

  it('class name', function () {
    expect(i18n.translateFunction(null)).toBe('');
    expect(i18n.translateFunction('aaa', 'aaa')).toBe('aaa');

    expect(i18n.translateFunction(null, null, 'testi18n')).toBe('');
    expect(i18n.translateFunction('aaa', 'aaa', 'testi18n')).toBe('AAA');
  });

  it('property name', function () {
    expect(i18n.translateProperty('aaa', '')).toBe('');
    expect(i18n.translateProperty('', 'bbb')).toBe('bbb');

    expect(i18n.translateProperty('aaa', 'bbb')).toBe('bbb');
    expect(i18n.translateProperty('aaa', 'bbb1')).toBe('bbb1');

    expect(i18n.translateProperty('aaa', 'bbb', 'testi18n')).toBe('BBB');
    expect(i18n.translateProperty('aaa', 'bbb1', 'testi18n')).toBe('BBB1');
  });
});
