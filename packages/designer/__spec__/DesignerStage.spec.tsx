import React, {StrictMode, useContext, useState} from 'react';
import {Block, Root} from '@ticlo/core';
import {makeLocalConnection, destroyLastLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {loadTemplate, removeLastTemplate} from '@ticlo/editor/util/test-util.ts';
import {DesignerStage} from '../DesignerStage.tsx';
import {
  DesignerContext,
  DesignerProvider,
  DesignerStageContext,
  type DesignerContextValue,
  type DesignerStageContextValue,
} from '../DesignerContext.tsx';
import {TicloApp} from '@ticlo/editor/component/TicloApp.tsx';

describe('DesignerStage', () => {
  const path = 'DesignerStageTest';

  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue(path);
    Root.instance.deleteValue(`${path}Second`);
  });

  it.each([true, false])('renders #main and reflects edits with serialize=%s', async (serialize) => {
    Root.instance.addFlow(path, {
      '#main': {
        '#is': 'react:div',
        '#order': ['title'],
        'title': {'#is': 'react:span', 'content': 'Original'},
      },
    });
    const [, conn] = makeLocalConnection(Root.instance, true, undefined, serialize);
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

  it('only uses #main directly on a flow as the page entry', async () => {
    const flow = Root.instance.addFlow(path, {
      child: {'#main': {'#is': 'react:p', 'content': 'Nested main'}},
    });
    const [, conn] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(
      <>
        <DesignerStage root={Root.instance} conn={conn} basePath={path} />
        <DesignerStage root={Root.instance} conn={conn} basePath={`${path}.child`} />
      </>
    );
    await shouldHappen(() => div.textContent.includes('This flow has no #main component.'));
    expect(div.textContent).toContain('This flow is not available.');
    expect(div.textContent).not.toContain('Nested main');

    flow.createBlock('#main').setValue('#is', 'react:p');
    (flow.getValue('#main') as Block).setValue('content', 'Flow main');
    await shouldHappen(() => div.textContent.includes('Flow main'));
    expect(div.textContent).not.toContain('Nested main');
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

  it('shares the active stage with outside panels and keeps selections per stage', async () => {
    const secondPath = `${path}Second`;
    const firstFlow = Root.instance.addFlow(path, {'#main': {'#is': 'react:div'}});
    const secondFlow = Root.instance.addFlow(secondPath, {'#main': {'#is': 'react:div'}});
    const firstMain = firstFlow.getValue('#main') as Block;
    const secondMain = secondFlow.getValue('#main') as Block;
    const stages = new Map<string, DesignerStageContextValue>();
    let designer: DesignerContextValue;
    let closeFirst: () => void;
    function StageProbe() {
      const stage = useContext(DesignerStageContext);
      stages.set(stage.basePath, stage);
      return <span>{stage.basePath}</span>;
    }
    function OutsidePanel() {
      designer = useContext(DesignerContext);
      return <span data-testid="active-stage">{designer.activeStage?.basePath}</span>;
    }
    firstMain.updateValue('content', <StageProbe />);
    secondMain.updateValue('content', <StageProbe />);
    const [, conn] = makeLocalConnection(Root.instance);
    function App() {
      const [showFirst, setShowFirst] = useState(true);
      closeFirst = () => setShowFirst(false);
      return (
        <TicloApp value={{}}>
          <DesignerProvider>
            <OutsidePanel />
            {showFirst && <DesignerStage root={Root.instance} conn={conn} basePath={path} />}
            <DesignerStage root={Root.instance} conn={conn} basePath={secondPath} />
          </DesignerProvider>
        </TicloApp>
      );
    }
    const [, div] = loadTemplate(
      <StrictMode>
        <App />
      </StrictMode>
    );
    await shouldHappen(() => stages.size === 2 && designer?.activeStage?.basePath === secondPath);
    stages.get(path).setSelectedComponents([firstMain]);
    await shouldHappen(() => stages.get(path).selectedComponents[0] === firstMain);
    expect(designer.activeStage.selectedComponents).toEqual([]);

    const firstStage = div.querySelectorAll('.ticl-designer-stage')[0];
    firstStage.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    await shouldHappen(() => designer.activeStage?.basePath === path);
    expect(designer.activeStage.flow).toBe(firstFlow);
    expect(designer.activeStage.conn).toBe(conn);
    expect(designer.activeStage.selectedComponents).toEqual([firstMain]);
    designer.activeStage.setSelectedComponents([]);
    await shouldHappen(() => stages.get(path).selectedComponents.length === 0);

    div.querySelectorAll('.ticl-designer-stage')[1].dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    await shouldHappen(() => designer.activeStage?.basePath === secondPath);
    designer.activeStage.setSelectedComponents([secondMain]);
    await shouldHappen(() => stages.get(secondPath).selectedComponents[0] === secondMain);
    Root.instance.deleteValue(secondPath);
    await shouldHappen(
      () => designer.activeStage?.flow === null && designer.activeStage.selectedComponents.length === 0
    );
    Root.instance.addFlow(secondPath, {'#main': {'#is': 'react:p', 'content': 'Replacement'}});
    await shouldHappen(() => designer.activeStage.flow === Root.instance.getValue(secondPath));
    expect(designer.activeStage.selectedComponents).toEqual([]);

    firstStage.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    await shouldHappen(() => designer.activeStage?.basePath === path);
    closeFirst();
    await shouldHappen(() => designer.activeStage === null);
  });
});
