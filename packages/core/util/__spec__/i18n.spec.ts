import {expect} from 'vitest';
import * as i18n from '../i18n.ts';
import i18next from 'i18next';

// @ts-ignore
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

    expect(i18n.translateFunction('sqlite:client', 'client', 'sqlite', undefined, 'sqlite-client')).toBe(
      'sqlite-client'
    );
    expect(i18n.translateFunction('aaa', 'aaa', 'testi18n', undefined, 'fallback')).toBe('AAA');
    try {
      i18n.TicloI18nSettings.shouldTranslateFunction = false;
      expect(i18n.translateFunction('sqlite:client', 'client', 'sqlite', undefined, 'sqlite-client')).toBe(
        'sqlite-client'
      );
    } finally {
      i18n.TicloI18nSettings.shouldTranslateFunction = true;
    }
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
