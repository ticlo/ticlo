import React, {useState} from 'react';
import {Root, globalFunctions} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {BlockStage, initEditor} from '../../index.ts';
import {PropertyList} from '../PropertyList.tsx';
import {loadTemplate, querySingle, removeLastTemplate} from '../../util/test-util.ts';

describe('dynamic #props descriptors', () => {
  const funcId = 'editor-test:dynamic-props';

  beforeAll(() => {
    globalFunctions.addFactory(
      null,
      {
        name: 'dynamic-props',
        dynamicProps: true,
        properties: [{name: 'src', type: 'string'}],
      },
      'editor-test'
    );
  });

  afterAll(() => {
    globalFunctions.delete(funcId);
  });

  beforeEach(async () => {
    await initEditor();
  });

  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue('DynamicPropsFlow');
  });

  it('renders and updates dynamic #props in PropertyList and BlockStage, and intersects them across multi-select', async () => {
    const flow = Root.instance.addFlow('DynamicPropsFlow', {
      b1: {
        '#is': funcId,
        'src': 'one',
        '@b-xyw': [100, 100, 200],
        '@b-p': ['src', 'sharedDyn', 'onlyOne'],
        '@b-inline': {onlyOne: true},
      },
      b2: {
        '#is': funcId,
        'src': 'two',
        '@b-xyw': [400, 100, 200],
        '@b-p': ['src'],
      },
    });
    const b1 = flow.getValue('b1') as ReturnType<typeof flow.createBlock>;
    const b2 = flow.getValue('b2') as ReturnType<typeof flow.createBlock>;
    b1.updateValue('#props', [
      {name: 'sharedDyn', type: 'string'},
      {name: 'onlyOne', type: 'number'},
    ]);
    b2.updateValue('#props', [
      {name: 'sharedDyn', type: 'string'},
      {name: 'onlyTwo', type: 'toggle'},
    ]);

    const [, conn] = makeLocalConnection(Root.instance);
    let setPaths!: (paths: string[]) => void;
    function Harness() {
      const [paths, setPathsState] = useState(['DynamicPropsFlow.b1']);
      setPaths = setPathsState;
      return (
        <>
          <BlockStage conn={conn} basePath="DynamicPropsFlow" style={{width: 700, height: 300}} />
          <PropertyList conn={conn} paths={paths} />
        </>
      );
    }
    const [, div] = loadTemplate(<Harness />, 'editor');

    const listProp = (name: string) =>
      querySingle(`//div[contains(@class,'ticl-e-property-name')]/span[text()='${name}']`, div);
    const stageField = (name: string) =>
      querySingle(`//div[contains(@class,'ticl-e-field-name')]/span[text()='${name}']`, div);

    await shouldHappen(() => listProp('src') && listProp('sharedDyn') && listProp('onlyOne'));
    await shouldHappen(() => stageField('onlyOne'));
    await shouldHappen(() => div.querySelector('.ticl-e-number-input'));

    // Live #props update adds new properties in PropertyList and updates Field descriptor type.
    b1.updateValue('#props', [
      {name: 'sharedDyn', type: 'string'},
      {name: 'onlyOne', type: 'toggle'},
      {name: 'addedDyn', type: 'string'},
    ]);
    await shouldHappen(() => listProp('addedDyn'));
    await shouldHappen(() => div.querySelector('.ticl-e-field-value .ant-switch'));

    // Multi-select b1 + b2 shows only intersecting dynamic properties (sharedDyn) alongside static properties (src).
    b1.updateValue('#props', [
      {name: 'sharedDyn', type: 'string'},
      {name: 'onlyOne', type: 'number'},
    ]);
    setPaths(['DynamicPropsFlow.b1', 'DynamicPropsFlow.b2']);
    await shouldHappen(() => listProp('src') && listProp('sharedDyn') && !listProp('onlyOne'));
    expect(listProp('onlyTwo')).toBeNull();
  });
});
