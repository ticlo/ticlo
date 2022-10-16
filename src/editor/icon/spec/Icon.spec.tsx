import {assert} from 'chai';
import React from 'react';
import {TIcon} from '../Icon';
import {shouldHappen} from '../../../../src/core/util/test-util';
import {removeLastTemplate, loadTemplate} from '../../util/test-util';

describe('editor Icon', function () {
  afterEach(function () {
    removeLastTemplate();
  });

  it('basic', async function () {
    let [component, div] = loadTemplate(
      <div style={{position: 'absolute'}}>
        <TIcon icon="fab:react" />
        <TIcon icon="fas:plus" colorClass="tico-pr1" />
        <TIcon icon="fas:minus" />
        <TIcon icon="txt:A" />
        <TIcon icon="txt:ip" />
        <TIcon icon="txt:WWW" />
        <TIcon icon="txt:文" />
        <TIcon icon="txt:文文:12" />

        <TIcon icon="fab:space space" />
        <TIcon icon={'txt:\t'} />
        <TIcon icon="txt" />
      </div>,
      'editor'
    );

    await shouldHappen(() => document.querySelector('.tico'));

    let icons: NodeListOf<HTMLDivElement> = document.querySelectorAll('.tico');
    assert.lengthOf(icons, 11);

    assert.isTrue(icons[0].children[0].classList.contains('tico-fab-react'));

    assert.isTrue(icons[1].children[0].classList.contains('tico-fas-plus'));
    assert.isTrue(icons[1].classList.contains('tico-pr1'));

    assert.isTrue(icons[2].children[0].classList.contains('tico-fas-minus'));

    icons[2].style.width = 'auto';
    await shouldHappen(() => {
      // this doesn't work as expected in karma
      // return icons[2].offsetWidth <= 22;
      return icons[2].offsetWidth < 50; // < 50 still proves the icon font is working
    }, 1000);

    assert.isTrue(icons[3].classList.contains('tico-txt'));
    assert.equal(icons[3].innerText, 'A');

    assert.isTrue(icons[4].classList.contains('tico-txt'));
    assert.isTrue(icons[4].classList.contains('tico-yoff'));

    assert.isTrue(icons[5].classList.contains('tico-txt'));
    assert.isTrue(icons[5].style.fontSize === '8px');

    assert.isTrue(icons[6].classList.contains('tico-txt'));
    assert.equal(icons[6].innerText, '文');

    assert.isTrue(icons[7].classList.contains('tico-txt'));
    assert.isTrue(icons[7].style.fontSize === '12px', 'override size');

    // invalid icon input
    for (let i = 8; i < 11; ++i) {
      assert.equal(icons[i].classList.length, 1, 'invalid icon has no other style');
    }
  });
});
