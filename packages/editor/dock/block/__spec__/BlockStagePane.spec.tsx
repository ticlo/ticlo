import React from 'react';
import {Block, Root, type Flow} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen.ts';
import {initEditor} from '../../../index.ts';
import {loadTemplate, removeLastTemplate} from '../../../util/test-util.ts';
import {BlockStagePane} from '../BlockStagePane.tsx';

describe('BlockStagePane', () => {
  const flowPath = 'BlockStagePaneReload';

  beforeEach(async () => {
    await initEditor();
  });

  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue(flowPath);
  });

  it.each([true, false])('reloads a runtime worker after consecutive saves (serialize=%s)', async (serialize) => {
    const flow = Root.instance.addFlow(flowPath);
    const child = {'#is': 'add', '0': 1, '1': 2, '@b-p': ['0', '1', '#output']};
    WorkerFunctionGen.registerType({'#is': '', 'add': child}, {id: ':fn', name: 'fn'}, undefined, flow.getFuncLib());
    flow.createBlock('fn').setValue('#is', ':fn');
    Root.run();
    const workerPath = `${flowPath}.fn.#worker`;
    const [, conn] = makeLocalConnection(Root.instance, true, undefined, serialize);
    let pane: BlockStagePane;
    const [, div] = loadTemplate(
      <BlockStagePane
        ref={(value) => {
          pane = value;
        }}
        conn={conn}
        basePath={workerPath}
      />,
      'editor'
    );
    const findBlock = (name: string) =>
      [...div.querySelectorAll('.ticl-e-block')].find(
        (block) => block.querySelector('.ticl-e-block-head-label')?.textContent.trim() === name
      );
    await shouldHappen(() => findBlock('add'));

    for (const [index, name] of ['first', 'second'].entries()) {
      const worker = Root.instance.queryValue(workerPath) as Flow;
      const stage = div.querySelector('.ticl-e-stage');
      await conn.addBlock(`${workerPath}.${name}`, child);
      await shouldHappen(() => findBlock(name));
      pane.onSelect([`${workerPath}.${name}`]);
      await shouldHappen(() => pane.state.selectedKeys.length === 1);
      await conn.applyFlowChange(workerPath);
      Root.run();

      const reloaded = Root.instance.queryValue(workerPath) as Flow;
      expect(reloaded).not.toBe(worker);
      expect(reloaded.getValue(name)).toBeInstanceOf(Block);
      await shouldHappen(
        () => {
          const nextStage = div.querySelector('.ticl-e-stage');
          return nextStage && nextStage !== stage;
        },
        1000,
        'stage reloads after save'
      );
      await shouldHappen(() => findBlock('add') && findBlock(name));
      expect(pane.state.selectedKeys).toEqual([]);

      await conn.setValue(`${workerPath}.${name}.0`, 10 + index, true);
      await shouldHappen(() =>
        [...(findBlock(name)?.querySelectorAll('.ticl-e-field-value') ?? [])].some(
          (field) => field.textContent === String(12 + index)
        )
      );
    }
  });
});
