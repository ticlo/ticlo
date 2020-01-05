import {assert} from 'chai';
import SimulateEvent from 'simulate-event';
import React from 'react';
import '../../../editor';
import {PropertyEditor} from '../PropertyEditor';
import {Block, Root} from '../../../core/block/Block';
import '../../../core/functions/basic/math/Arithmetic';
import {destroyLastLocalConnection, makeLocalConnection} from '../../../core/connect/LocalConnection';
import {shouldHappen, shouldReject} from '../../../core/util/test-util';
import ReactDOM from 'react-dom';
import {removeLastTemplate, loadTemplate, querySingle} from '../../util/test-util';
import {initEditor} from '../../index';
import {arrayEqual} from '../../../core/util/Compare';
import {ClientConn} from '../../../core/client';
import {FunctionDesc, PropDesc, PropGroupDesc} from '../../../core/block/Descriptor';
import {Types} from '../../../core/block/Type';

describe('PropertyEditor', function() {
  let [funcDesc] = Types.getDesc('add');
  let propDesc = (funcDesc.properties[0] as PropGroupDesc).properties[0];

  beforeEach(async function() {
    await initEditor();
  });

  afterEach(function() {
    removeLastTemplate();
    destroyLastLocalConnection();
  });

  it('editable', async function() {
    let job = Root.instance.addJob('PropertyEditor1');
    job.load({
      add1: {
        '#is': 'add',
        '0': 1
      },
      add2: {
        '#is': 'add',
        '0': 1
      }
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
    assert.isFalse(input.classList.contains('ticl-number-input-disabled'));

    // value is not editable when value is different
    job.queryProperty('add1.0').setValue(2);
    await shouldHappen(() => input.classList.contains('ticl-number-input-disabled'));

    job.queryProperty('add1.0').setValue(undefined);
    job.queryProperty('add2.0').setValue(undefined);
    await shouldHappen(() => !input.classList.contains('ticl-number-input-disabled'));

    // value is not editable when there is a binding
    job.queryProperty('add1.0').setBinding('1');
    await shouldHappen(() => input.classList.contains('ticl-number-input-disabled'));

    Root.instance.deleteValue('PropertyEditor1');
  });

  it('subblock', async function() {
    let job = Root.instance.addJob('PropertyEditor2');
    job.load({
      add1: {
        '#is': 'add',
        '~0': {'#is': 'add'}
      },
      add2: {
        '#is': 'add',
        '~0': {'#is': 'add'}
      }
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

    assert.isNotNull(expandIcon);
    assert.isNull(div.querySelector('.ticl-property-list'));

    // subblock should expand
    SimulateEvent.simulate(expandIcon, 'click');
    await shouldHappen(() => div.querySelector('.ticl-property-list'));
    // find the child property group for #len 0 1
    await shouldHappen(() => div.querySelector('.ticl-property-group'));

    Root.instance.deleteValue('PropertyEditor2');
  });
});
