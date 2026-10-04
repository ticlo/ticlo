import React from 'react';
import {Block, Root} from '@ticlo/core';
import {makeLocalConnection, destroyLastLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {loadTemplate, removeLastTemplate} from '@ticlo/editor/util/test-util.ts';
import {DesignerStage} from '../DesignerStage.tsx';

describe('DesignerStage', () => {
  const path = 'DesignerStageTest';

  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue(path);
  });

  it('renders #main and reflects changes from the editor connection', async () => {
    Root.instance.addFlow(path, {
      '#main': {
        '#is': 'react:div',
        '#order': ['title'],
        'title': {'#is': 'react:span', 'content': 'Original'},
      },
    });
    const [, conn] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(<DesignerStage root={Root.instance} conn={conn} basePath={path} />);
    await shouldHappen(() => div.querySelector('.ticl-designer-page span')?.textContent === 'Original');

    await conn.setValue(`${path}.#main.title.content`, 'Updated', true);
    await shouldHappen(() => div.querySelector('.ticl-designer-page span')?.textContent === 'Updated');

    const flow = Root.instance.getValue(path) as Block;
    flow.deleteValue('#main');
    await shouldHappen(() => div.textContent.includes('This flow has no #main component.'));
    const replacement = flow.createBlock('#main');
    replacement.setValue('#is', 'react:p');
    replacement.setValue('content', 'Replacement');
    await shouldHappen(() => div.querySelector('.ticl-designer-page p')?.textContent === 'Replacement');
  });

  it('shows an empty state instead of rendering #output', async () => {
    const flow = Root.instance.addFlow(path, {});
    flow.updateValue('#output', <span>Data output</span>);
    const [, conn] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(<DesignerStage root={Root.instance} conn={conn} basePath={path} />);
    await shouldHappen(() => div.textContent.includes('This flow has no #main component.'));
    expect(div.textContent).not.toContain('Data output');

    flow.updateValue('#main', <span>React page</span>);
    await shouldHappen(() => div.textContent === 'React page');
  });

  it('updates the page when its flow is replaced or removed', async () => {
    Root.instance.addFlow(path, {'#main': {'#is': 'react:p', 'content': 'First'}});
    const [, conn] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(<DesignerStage root={Root.instance} conn={conn} basePath={path} />);
    await shouldHappen(() => div.textContent === 'First');

    Root.instance.deleteValue(path);
    await shouldHappen(() => div.textContent.includes('This flow is not available.'));
    Root.instance.addFlow(path, {'#main': {'#is': 'react:p', 'content': 'Second'}});
    await shouldHappen(() => div.textContent === 'Second');
  });
});
