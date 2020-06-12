import {assert} from 'chai';
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
    assert.equal(i18n.translateFunction(null), '');
    assert.equal(i18n.translateFunction('aaa', 'aaa'), 'aaa');

    assert.equal(i18n.translateFunction(null, null, 'testi18n'), '');
    assert.equal(i18n.translateFunction('aaa', 'aaa', 'testi18n'), 'AAA');
  });

  it('property name', function () {
    assert.equal(i18n.translateProperty('aaa', ''), '');
    assert.equal(i18n.translateProperty('', 'bbb'), 'bbb');

    assert.equal(i18n.translateProperty('aaa', 'bbb'), 'bbb');
    assert.equal(i18n.translateProperty('aaa', 'bbb1'), 'bbb1');

    assert.equal(i18n.translateProperty('aaa', 'bbb', 'testi18n'), 'BBB');
    assert.equal(i18n.translateProperty('aaa', 'bbb1', 'testi18n'), 'BBB1');
  });
});
