import {expect} from 'vitest';
import React from 'react';
import {TIcon} from '../Icon';
import {shouldHappen} from '@ticlo/core/util/test-util';
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
    expect(icons.length).toBe(11);

    expect(icons[0].children[0].classList.contains('tico-fab-react')).toBe(true);

    expect(icons[1].children[0].classList.contains('tico-fas-plus')).toBe(true);
    expect(icons[1].classList.contains('tico-pr1')).toBe(true);

    expect(icons[2].children[0].classList.contains('tico-fas-minus')).toBe(true);

    icons[2].style.width = 'auto';
    await shouldHappen(() => {
      // this doesn't work as expected in karma
      // return icons[2].offsetWidth <= 22;
      return icons[2].offsetWidth < 50; // < 50 still proves the icon font is working
    }, 1000);

    expect(icons[3].classList.contains('tico-txt')).toBe(true);
    expect(icons[3].innerText).toBe('A');

    expect(icons[4].classList.contains('tico-txt')).toBe(true);
    expect(icons[4].classList.contains('tico-yoff')).toBe(true);

    expect(icons[5].classList.contains('tico-txt')).toBe(true);
    expect(icons[5].style.fontSize === '8px').toBe(true);

    expect(icons[6].classList.contains('tico-txt')).toBe(true);
    expect(icons[6].innerText).toBe('文');

    expect(icons[7].classList.contains('tico-txt')).toBe(true);
    expect(icons[7].style.fontSize === '12px').toBe(true);

    // invalid icon input
    for (let i = 8; i < 11; ++i) {
      expect(icons[i].classList.length).toBe(1);
    }
  });
});
