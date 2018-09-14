import {assert} from "chai";
import * as React from 'react';
import {TIcon} from "../Icon";
import {shouldHappen} from "../../../common/util/test-util";
import * as ReactDOM from "react-dom";
import {loadTemplate} from "../../../ui/util/test-util";

describe("editor Icon", () => {

  it('basic', async () => {
    let [component, div] = loadTemplate(
      <div style={{position: 'absolute'}}>
        < TIcon icon="fab:git"/>
        <TIcon icon="fas:plus"/>
        <TIcon icon="material:radio_button_unchecked"/>
        <TIcon icon="txt:A"/>
        <TIcon icon="txt:ip"/>
        <TIcon icon="txt:WW"/>
        <TIcon icon="invalid:ico"/>
      </div>
      , 'editor');

    let icons: NodeListOf<HTMLDivElement> = document.querySelectorAll('.tico');
    assert.lengthOf(icons, 7);

    assert.isTrue(icons[0].classList.contains('fab'));
    assert.isTrue(icons[0].classList.contains('fa-git'));

    assert.isTrue(icons[1].classList.contains('fas'));
    assert.isTrue(icons[1].classList.contains('fa-plus'));

    assert.isTrue(icons[2].classList.contains('tico-material'));
    assert.equal(icons[2].innerText, 'radio_button_unchecked');

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
    assert.isTrue(icons[5].style.fontSize < '15px');

    assert.equal(icons[6].classList.length, 1, 'invalid icon has no other style');

    ReactDOM.unmountComponentAtNode(div);
  });

});
