import {expect} from 'vitest';
import {simulate} from 'simulate-event';
import React from 'react';
import '../../index';
import {PropertyEditor} from '../PropertyEditor';
import {Block, Root} from '@ticlo/core';
import '../../../core/functions/math/Arithmetic';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection';
import {shouldHappen, shouldReject} from '@ticlo/core/util/test-util';
import {removeLastTemplate, loadTemplate, querySingle} from '../../util/test-util';
import {initEditor} from '../../index';
import {FunctionDesc, PropDesc, PropGroupDesc} from '@ticlo/core';
import {Functions} from '@ticlo/core/block/Functions';

describe('PropertyEditor', function () {
  let [funcDesc] = Functions.getDescToSend('add');
  let propDesc = (funcDesc.properties[0] as PropGroupDesc).properties[0];

  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
    destroyLastLocalConnection();
  });

  it('editable', async function () {
    let flow = Root.instance.addFlow('PropertyEditor1');
    flow.load({
      add1: {
        '#is': 'add',
        '0': 1,
      },
      add2: {
        '#is': 'add',
        '0': 1,
      },
    });

    let [server, client] = makeLocalConnection(Root.instance, true);

    let [component, div] = loadTemplate(
      <PropertyEditor
        conn={client}
        paths={['PropertyEditor1.add1', 'PropertyEditor1.add2']}
        name="0"
        funcDesc={funcDesc}
        propDesc={propDesc}
      />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-number-input'));
    let input = div.querySelector('.ticl-number-input');

    // value is editable when value is same
    expect(input.classList.contains('ticl-number-input-disabled')).toBe(false);

    // value is not editable when value is different
    flow.queryProperty('add1.0').setValue(2);
    await shouldHappen(() => input.classList.contains('ticl-number-input-disabled'));

    flow.queryProperty('add1.0').setValue(undefined);
    flow.queryProperty('add2.0').setValue(undefined);
    await shouldHappen(() => !input.classList.contains('ticl-number-input-disabled'));

    // value is not editable when there is a binding
    flow.queryProperty('add1.0').setBinding('1');
    await shouldHappen(() => input.classList.contains('ticl-number-input-disabled'));

    Root.instance.deleteValue('PropertyEditor1');
  });

  it('subblock', async function () {
    let flow = Root.instance.addFlow('PropertyEditor2');
    flow.load({
      add1: {
        '#is': 'add',
        '~0': {'#is': 'add'},
      },
      add2: {
        '#is': 'add',
        '~0': {'#is': 'add'},
      },
    });

    let [server, client] = makeLocalConnection(Root.instance, true);

    let [component, div] = loadTemplate(
      <PropertyEditor
        conn={client}
        paths={['PropertyEditor2.add1', 'PropertyEditor2.add2']}
        name="0"
        funcDesc={funcDesc}
        propDesc={propDesc}
      />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-number-input'));
    let input = div.querySelector('.ticl-number-input');

    let expandIcon = div.querySelector('.ticl-tree-arr-expand');

    expect(expandIcon).not.toBeNull();
    expect(div.querySelector('.ticl-property-list')).toBeNull();

    // subblock should expand
    simulate(expandIcon, 'click');
    await shouldHappen(() => div.querySelector('.ticl-property-list'));
    // find the child property group for [] 0 1
    await shouldHappen(() => div.querySelector('.ticl-property-group'));

    Root.instance.deleteValue('PropertyEditor2');
  });
});
