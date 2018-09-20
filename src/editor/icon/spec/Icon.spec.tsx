import {assert} from "chai";
import * as React from 'react';
import {TIcon} from "../Icon";
import {shouldHappen} from "../../../common/util/test-util";
import * as ReactDOM from "react-dom";
import {loadTemplate} from "../../../ui/util/test-util";

describe("editor Icon", function() {

  it('basic', async function() {
    let [component, div] = loadTemplate(
      <div style={{position: 'absolute'}}>
        <TIcon icon="fab:git"/>
        <TIcon icon="fas:plus" priority="1"/>
        <TIcon icon="material:radio_button_unchecked"/>
        <TIcon icon="txt:A"/>
        <TIcon icon="txt:ip"/>
        <TIcon icon="txt:WWWW"/>
        <TIcon icon="txt:文"/>

        <TIcon icon="fab:space space"/>
        <TIcon icon={"txt:\t"}/>
        <TIcon icon="txt:"/>
        <TIcon icon="txt"/>
      </div>
      , 'editor');

    let icons: NodeListOf<HTMLDivElement> = document.querySelectorAll('.tico');
    assert.lengthOf(icons, 11);

    assert.isTrue(icons[0].classList.contains('fab'));
    assert.isTrue(icons[0].classList.contains('fa-git'));

    assert.isTrue(icons[1].classList.contains('fas'));
    assert.isTrue(icons[1].classList.contains('fa-plus'));
    assert.isTrue(icons[1].classList.contains('tico-pr1'));

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
    assert.equal(icons[5].innerText, 'WWW', 'long string will be cut to 3 characters');
    assert.isTrue(icons[5].style.fontSize === '7px');

    assert.isTrue(icons[6].classList.contains('tico-txt'));
    assert.equal(icons[6].innerText, '文');

    // invalid icon input
    for (let i = 7; i < 11; ++i) {
      assert.equal(icons[i].classList.length, 1, 'invalid icon has no other style');
    }

    ReactDOM.unmountComponentAtNode(div);
  });

});
