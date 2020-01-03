import {assert} from 'chai';
import SimulateEvent from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from '../../../../react/util/test-util';
import {initEditor} from '../../../index';
import {ColorEditor} from '../ColorEditor';
import {shouldHappen} from '../../../../core/util/test-util';
import {blankPropDesc, PropDesc} from '../../../../core/block/Descriptor';

describe('ColorEditor', function() {
  beforeEach(async function() {
    await initEditor();
  });

  afterEach(function() {
    removeLastTemplate();
  });

  it('basic', async function() {
    let value: string = null;
    let onChange = (v: string) => {
      value = v;
    };
    let desc: PropDesc = {name: '', type: 'color'};
    let [component, div] = loadTemplate(<ColorEditor value="#000000" desc={desc} onChange={onChange} />, 'editor');

    await shouldHappen(() => div.querySelector('.ticl-color-editor'));
    let colorDiv = div.querySelector('.ticl-color-editor');

    SimulateEvent.simulate(colorDiv, 'click');

    await shouldHappen(() => querySingle("//div[@title='#FFFFFF']", document.body));

    SimulateEvent.simulate(querySingle("//div[@title='#FFFFFF']", document.body), 'click');

    await shouldHappen(() => value === '#ffffff');
  });
});
