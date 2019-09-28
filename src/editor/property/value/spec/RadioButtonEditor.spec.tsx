import {assert} from 'chai';
import SimulateEvent from 'simulate-event';
import React from 'react';
import {removeLastTemplate, loadTemplate, querySingle} from '../../../../ui/util/test-util';
import {initEditor} from '../../../index';
import {RadioButtonEditor} from '../RadioButtonEditor';
import {shouldHappen} from '../../../../core/util/test-util';
import {blankPropDesc, PropDesc} from '../../../../core/block/Descriptor';

describe('RadioButtonEditor', function() {
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
    let desc: PropDesc = {name: '', type: 'select', options: ['a', 'b', 'c']};
    let [component, div] = loadTemplate(<RadioButtonEditor value="a" desc={desc} onChange={onChange} />, 'editor');

    await shouldHappen(() => div.querySelectorAll('.ant-radio-button').length === 3);
    let buttons = div.querySelectorAll('.ant-radio-button');

    SimulateEvent.simulate(buttons[1], 'click');
    await shouldHappen(() => value === 'b');
  });
});
