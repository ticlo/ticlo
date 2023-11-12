import expect from 'expect';
import * as i18n from '../i18n';
import i18next from 'i18next';

describe('i18n', function () {
  before(async function () {
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
    expect(i18n.translateFunction(null)).toEqual('');
    expect(i18n.translateFunction('aaa', 'aaa')).toEqual('aaa');

    expect(i18n.translateFunction(null, null, 'testi18n')).toEqual('');
    expect(i18n.translateFunction('aaa', 'aaa', 'testi18n')).toEqual('AAA');
  });

  it('property name', function () {
    expect(i18n.translateProperty('aaa', '')).toEqual('');
    expect(i18n.translateProperty('', 'bbb')).toEqual('bbb');

    expect(i18n.translateProperty('aaa', 'bbb')).toEqual('bbb');
    expect(i18n.translateProperty('aaa', 'bbb1')).toEqual('bbb1');

    expect(i18n.translateProperty('aaa', 'bbb', 'testi18n')).toEqual('BBB');
    expect(i18n.translateProperty('aaa', 'bbb1', 'testi18n')).toEqual('BBB1');
  });
});
