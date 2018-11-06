import {assert} from "chai";
import * as i18n from "../i18n";
import * as i18next from "i18next"

describe("i18n", function () {

  before(async function () {
    await i18n.init('en');
    i18next.addResourceBundle('en', 'ticlo-testi18n', {
      'aaa': {
        '@name': 'AAA',
        'bbb': {
          '@name': 'BBB'
        }
      }
    });
  });

  it('class name', function () {

    assert.equal(i18n.transLateType(null), '');
    assert.equal(i18n.transLateType('aaa'), 'aaa');

    assert.equal(i18n.transLateType(null, 'testi18n'), '');
    assert.equal(i18n.transLateType('aaa', 'testi18n'), 'AAA');
  });

  it('property name', function () {

    assert.equal(i18n.transLateProperty('aaa', ''), '');
    assert.equal(i18n.transLateProperty('', 'bbb'), '');

    assert.equal(i18n.transLateProperty('aaa', 'bbb'), 'bbb');
    assert.equal(i18n.transLateProperty('aaa', 'bbb1'), 'bbb1');

    assert.equal(i18n.transLateProperty('aaa', 'bbb', 'testi18n'), 'BBB');
    assert.equal(i18n.transLateProperty('aaa', 'bbb1', 'testi18n'), 'BBB1');
  });
});
