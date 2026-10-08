import React, {StrictMode, useContext, useState} from 'react';
import '../style/index.css';
import {expectTypeOf} from 'vitest';
import {Block, Root} from '@ticlo/core';
import {ComponentContext, type ComponentContextValue} from '@ticlo/react';
import {makeLocalConnection, destroyLastLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {loadTemplate, removeLastTemplate, querySingle} from '@ticlo/editor/util/test-util.ts';
import {DesignerStage} from '../DesignerStage.tsx';
import {
  DesignerLayoutContextType,
  useActiveDesignerStage,
  type DesignerStageContextValue,
} from '../DesignerContext.tsx';
import {DesignerApp} from '../DesignerApp.tsx';
import {DesignerNodeTree} from '../DesignerNodeTree.tsx';
import {
  TicloCurrentFlowContext,
  TicloLayoutContextType,
  type TicloCurrentFlow,
  type TicloLayoutContext,
} from '@ticlo/editor/component/LayoutContext.ts';

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
    await shouldHappen(() => div.querySelector('.ticl-d-page span')?.textContent === 'Original');

    await conn.setValue(`${path}.#main.title.content`, 'Updated', true);
    await shouldHappen(() => div.querySelector('.ticl-d-page span')?.textContent === 'Updated');

    const flow = Root.instance.getValue(path) as Block;
    flow.deleteValue('#main');
    await shouldHappen(() => div.textContent.includes('This flow has no #main component.'));
    const replacement = flow.createBlock('#main');
    replacement.setValue('#is', 'react:p');
    replacement.setValue('content', 'Replacement');
    await shouldHappen(() => div.querySelector('.ticl-d-page p')?.textContent === 'Replacement');
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
    let activeStage: DesignerStageContextValue;
    let closeFirst: () => void;
    function OutsidePanel() {
      activeStage = useActiveDesignerStage();
      return <span data-testid="active-stage">{activeStage?.basePath}</span>;
    }
    const [, conn] = makeLocalConnection(Root.instance);
    function App() {
      const [showFirst, setShowFirst] = useState(true);
      closeFirst = () => setShowFirst(false);
      return (
        <DesignerApp value={{}}>
          <OutsidePanel />
          {showFirst && <DesignerStage root={Root.instance} conn={conn} basePath={path} />}
          <DesignerStage root={Root.instance} conn={conn} basePath={secondPath} />
        </DesignerApp>
      );
    }
    const [, div] = loadTemplate(
      <StrictMode>
        <App />
      </StrictMode>
    );
    await shouldHappen(() => activeStage?.basePath === secondPath);
    expect(activeStage.selection.blocks).toEqual([]);

    const firstStage = div.querySelectorAll('.ticl-d-stage')[0];
    firstStage.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    await shouldHappen(() => activeStage?.basePath === path);
    expect(activeStage.flow).toBe(firstFlow);
    expect(activeStage.conn).toBe(conn);
    activeStage.select([firstMain]);
    await shouldHappen(() => activeStage.selection.blocks[0] === firstMain);
    expect(activeStage.selection.blocks).toEqual([firstMain]);
    expect(activeStage.selection.paths).toEqual([`${path}.#main`]);

    div.querySelectorAll('.ticl-d-stage')[1].dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    await shouldHappen(() => activeStage?.basePath === secondPath);
    activeStage.select([secondMain]);
    await shouldHappen(() => activeStage.selection.blocks[0] === secondMain);
    Root.instance.deleteValue(secondPath);
    await shouldHappen(() => activeStage?.flow === null && activeStage.selection.blocks.length === 0);
    Root.instance.addFlow(secondPath, {'#main': {'#is': 'react:p', 'content': 'Replacement'}});
    await shouldHappen(() => activeStage.flow === Root.instance.getValue(secondPath));
    expect(activeStage.selection.blocks).toEqual([]);

    firstStage.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    await shouldHappen(() => activeStage?.basePath === path);
    expect(activeStage.selection.blocks).toEqual([firstMain]);
    activeStage.select([]);
    await shouldHappen(() => activeStage.selection.blocks.length === 0);
    closeFirst();
    await shouldHappen(() => activeStage === null);
  });

  it('keeps page components stable across selection and panel updates, and updates mode consumers', async () => {
    expectTypeOf<keyof ComponentContextValue>().toEqualTypeOf<
      'designMode' | 'elementMap' | 'select' | 'addSelection'
    >();
    const secondPath = `${path}Second`;
    const firstFlow = Root.instance.addFlow(path, {
      '#main': {'#is': 'react:div', 'a': {'#is': 'react:p'}, 'b': {'#is': 'react:p'}},
    });
    const secondFlow = Root.instance.addFlow(secondPath, {'#main': {'#is': 'react:div'}});
    const main = firstFlow.getValue('#main') as Block;
    const a = main.getValue('a') as Block;
    const b = main.getValue('b') as Block;
    const renders = {first: 0, second: 0, plain: 0};
    const components: Record<string, ComponentContextValue<Block | string>> = {};
    let activeStage: DesignerStageContextValue;
    let context: TicloCurrentFlow;
    let language: string;
    let refreshApp: () => void;
    function ComponentProbe({name}: {name: 'first' | 'second'}) {
      const component = useContext(ComponentContext);
      components[name] = component;
      ++renders[name];
      return <span data-testid={name}>{String(component.designMode)}</span>;
    }
    function PlainComponent() {
      ++renders.plain;
      return <span>ordinary component</span>;
    }
    function OutsideComponent() {
      const component = useContext(ComponentContext);
      return <span data-testid="outside">{String(component.designMode)}</span>;
    }
    function Panel() {
      activeStage = useActiveDesignerStage();
      context = useContext(TicloCurrentFlowContext);
      language = useContext(TicloLayoutContextType).language;
      return <span data-testid="selection">{activeStage?.selection.paths.join(',')}</span>;
    }
    main.updateValue(
      'content',
      <>
        <ComponentProbe name="first" />
        <PlainComponent />
      </>
    );
    (secondFlow.getValue('#main') as Block).updateValue('content', <ComponentProbe name="second" />);
    const [, conn] = makeLocalConnection(Root.instance, true, undefined, false);
    function App() {
      const [version, setVersion] = useState(0);
      refreshApp = () => setVersion((value) => value + 1);
      return (
        <DesignerApp value={{language: version ? 'zh' : 'en'}}>
          <DesignerStage root={Root.instance} conn={conn} basePath={path} />
          <DesignerStage root={Root.instance} conn={conn} basePath={secondPath} />
          <OutsideComponent />
          <Panel />
        </DesignerApp>
      );
    }
    const [, div] = loadTemplate(
      <StrictMode>
        <App />
      </StrictMode>
    );
    await shouldHappen(() => components.first && components.second && activeStage?.basePath === secondPath);
    context.onFlowFocus(path);
    await shouldHappen(() => activeStage?.basePath === path);
    const initialRenders = {...renders};
    const componentContext = components.first;
    expect(div.querySelector('[data-testid="outside"]').textContent).toBe('false');

    expect(componentContext.select([a])).toBe(true);
    expect(componentContext.select([a])).toBe(false);
    expect(componentContext.addSelection([b, a, `${path}.outside`])).toBe(true);
    expect(componentContext.addSelection([a, b])).toBe(false);
    expect(componentContext.addSelection([`${path}.outside`, `${path}.missing`])).toBe(false);
    await shouldHappen(() => activeStage.selection.blocks.length === 2);
    expect(activeStage.selection).toEqual({blocks: [a, b], paths: [`${path}.#main.a`, `${path}.#main.b`]});
    expect(div.querySelector('[data-testid="selection"]').textContent).toBe(`${path}.#main.a,${path}.#main.b`);
    expect(components.first).toBe(componentContext);
    expect(renders).toEqual(initialRenders);

    context.onFlowFocus(secondPath);
    await shouldHappen(() => activeStage?.basePath === secondPath);
    refreshApp();
    await shouldHappen(() => language === 'zh');
    context.onFlowFocus(path);
    await shouldHappen(() => activeStage?.basePath === path);
    expect(activeStage.select([`${path}.#main.a`])).toBe(false);
    await shouldHappen(() => activeStage.selection.paths.length === 1);
    expect(renders).toEqual(initialRenders);
    expect(activeStage.select).toBe(componentContext.select);
    expect(activeStage.addSelection).toBe(componentContext.addSelection);

    activeStage.setDesignMode(false);
    await shouldHappen(
      () => div.querySelector('[data-testid="first"]').textContent === 'false' && !activeStage.designMode
    );
    expect(activeStage.designMode).toBe(false);
    expect(renders.first).toBeGreaterThan(initialRenders.first);
    expect(renders.second).toBeGreaterThan(initialRenders.second);
    expect(div.querySelector('[data-testid="second"]').textContent).toBe('false');
    expect(renders.plain).toBe(initialRenders.plain);
    expect(div.querySelector('[data-testid="outside"]').textContent).toBe('false');
    expect(components.first.select).toBe(componentContext.select);
    expect(components.first.addSelection).toBe(componentContext.addSelection);
    activeStage.setDesignMode(true);
    await shouldHappen(
      () => div.querySelector('[data-testid="first"]').textContent === 'true' && activeStage.designMode
    );
  });

  it('limits added selections to siblings after a cross-parent outline selection', async () => {
    const flow = Root.instance.addFlow(path, {
      '#main': {
        '#is': 'react:div',
        '#order': ['a', 'b'],
        'a': {
          '#is': 'react:div',
          '#order': ['c', 'd'],
          'c': {'#is': 'react:p', 'content': 'C'},
          'd': {'#is': 'react:p', 'content': 'D'},
        },
        'b': {'#is': 'react:p', 'content': 'B'},
      },
    });
    const main = flow.getValue('#main') as Block;
    const a = main.getValue('a') as Block;
    const b = main.getValue('b') as Block;
    const c = a.getValue('c') as Block;
    const d = a.getValue('d') as Block;
    const [, conn] = makeLocalConnection(Root.instance, true, undefined, false);
    let stage: DesignerStageContextValue;
    function Panel(): null {
      stage = useActiveDesignerStage();
      return null;
    }
    const [, div] = loadTemplate(
      <DesignerApp value={{}}>
        <DesignerStage root={Root.instance} conn={conn} basePath={path} />
        <Panel />
      </DesignerApp>
    );
    await shouldHappen(() => stage?.main === main && div.querySelectorAll('p').length === 3);

    stage.select([b, c]);
    await shouldHappen(() => stage.selection.blocks.length === 2);
    expect(stage.selection.blocks).toEqual([b, c]);
    expect(stage.addSelection([`${path}.missing`])).toBe(false);
    expect(stage.addSelection([c])).toBe(false);
    await shouldHappen(() => stage.selection.blocks.length === 1);
    expect(stage.selection).toEqual({blocks: [c], paths: [`${path}.#main.a.c`]});

    stage.select([b, c]);
    expect(stage.addSelection([`${path}.missing`])).toBe(false);
    await shouldHappen(() => stage.selection.blocks.length === 2);
    expect(stage.selection.blocks).toEqual([b, c]);

    stage.select([b, c]);
    expect(stage.addSelection([`${path}.#main.a.d`])).toBe(true);
    await shouldHappen(() => stage.selection.blocks[1] === d);
    expect(stage.selection).toEqual({
      blocks: [c, d],
      paths: [`${path}.#main.a.c`, `${path}.#main.a.d`],
    });
    expect(stage.addSelection([d])).toBe(false);

    const parent = div.querySelector('.ticl-d-page > div > div');
    parent.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, ctrlKey: true}));
    parent.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, ctrlKey: true}));
    await shouldHappen(() => stage.selection.blocks.length === 1 && stage.selection.blocks[0] === a);
    expect(stage.selection.paths).toEqual([`${path}.#main.a`]);
    const sibling = div.querySelector('.ticl-d-page > div > p');
    sibling.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, ctrlKey: true}));
    sibling.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, ctrlKey: true}));
    await shouldHappen(() => stage.selection.blocks.length === 2);
    expect(stage.selection.blocks).toEqual([a, b]);

    expect(stage.addSelection([c, b, `${path}.missing`, c])).toBe(true);
    await shouldHappen(() => stage.selection.blocks.length === 1 && stage.selection.blocks[0] === c);
    expect(stage.selection.paths).toEqual([`${path}.#main.a.c`]);
  });

  it('shares global design mode with panels and stages opened later while retaining stage selection', async () => {
    expectTypeOf<Extract<keyof TicloLayoutContext, 'designMode' | 'setDesignMode'>>().toEqualTypeOf<never>();
    const flow = Root.instance.addFlow(path, {'#main': {'#is': 'react:p', 'content': 'First'}});
    const secondPath = `${path}Second`;
    Root.instance.addFlow(secondPath, {'#main': {'#is': 'react:p', 'content': 'Second'}});
    const main = flow.getValue('#main') as Block;
    const [, conn] = makeLocalConnection(Root.instance, true, undefined, false);
    let stage: DesignerStageContextValue;
    let openSecond: () => void;
    function ToolBox() {
      const {designMode, setDesignMode} = useContext(DesignerLayoutContextType);
      stage = useActiveDesignerStage();
      return <button onClick={() => setDesignMode(!designMode)}>{designMode ? 'Design' : 'Preview'}</button>;
    }
    function App() {
      const [showSecond, setShowSecond] = useState(false);
      openSecond = () => setShowSecond(true);
      return (
        <DesignerApp value={{}}>
          <ToolBox />
          <DesignerStage root={Root.instance} conn={conn} basePath={path} />
          {showSecond && <DesignerStage root={Root.instance} conn={conn} basePath={secondPath} />}
        </DesignerApp>
      );
    }
    const [, div] = loadTemplate(<App />);
    await shouldHappen(() => stage?.main === main);
    stage.select([main]);
    await shouldHappen(() => stage.selection.blocks[0] === main);
    const toggle = div.querySelector('button');
    toggle.click();
    await shouldHappen(() => toggle.textContent === 'Preview' && !stage.designMode);
    expect(div.querySelector('.ticl-d-stage-design')).toBeNull();
    expect(stage.selection.blocks).toEqual([main]);
    openSecond();
    await shouldHappen(() => stage.basePath === secondPath && div.querySelectorAll('.ticl-d-stage').length === 2);
    expect(stage.designMode).toBe(false);
    expect(div.querySelector('.ticl-d-stage-design')).toBeNull();
    toggle.click();
    await shouldHappen(() => div.querySelectorAll('.ticl-d-stage-design').length === 2 && stage.designMode);
    expect(toggle.textContent).toBe('Design');
    expect(stage.designMode).toBe(true);
    await shouldHappen(() => div.querySelectorAll('.ticl-d-selection-rect').length === 1);
  });

  it('exposes undo and redo through panels and keyboard commands', async () => {
    const flow = Root.instance.addFlow(
      path,
      {'#main': {'#is': 'react:p', 'content': 'Original'}},
      {applyChange: (flow) => flow.save()}
    );
    const [, conn] = makeLocalConnection(Root.instance, true, undefined, false);
    let stage: DesignerStageContextValue;
    function Panel(): null {
      stage = useActiveDesignerStage();
      return null;
    }
    const [, div] = loadTemplate(
      <DesignerApp value={{}}>
        <DesignerStage root={Root.instance} conn={conn} basePath={path} />
        <Panel />
      </DesignerApp>
    );
    await shouldHappen(() => stage?.flow === flow && div.textContent === 'Original');
    await conn.setValue(`${path}.#main.content`, 'Changed', true);
    await shouldHappen(() => div.textContent === 'Changed');
    const host = div.querySelector<HTMLElement>('.ticl-d-stage');
    host.focus();
    host.dispatchEvent(new KeyboardEvent('keydown', {key: 'z', ctrlKey: true, bubbles: true}));
    await shouldHappen(() => div.textContent === 'Original');
    expect(stage.redo()).toBe(true);
    await shouldHappen(() => div.textContent === 'Changed');
    expect(stage.undo()).toBe(true);
    await shouldHappen(() => div.textContent === 'Original');
  });

  it('synchronizes the main node tree with both selection caches and the active stage', async () => {
    expectTypeOf<TicloCurrentFlow<DesignerStageContextValue>['activeStage']['selection']['blocks']>().toEqualTypeOf<
      Block[]
    >();
    const flow = Root.instance.addFlow(path, {
      '#main': {
        '#is': 'react:div',
        '#order': ['a', 'b'],
        'a': {'#is': 'react:p', 'content': 'First'},
        'b': {'#is': 'react:p', 'content': 'Second'},
      },
      'outside': {'#is': 'react:p', 'content': 'Not in page'},
    });
    const secondPath = `${path}Second`;
    Root.instance.addFlow(secondPath, {'#main': {'#is': 'react:p', 'content': 'Other page'}});
    const main = flow.getValue('#main') as Block;
    const a = main.getValue('a') as Block;
    const b = main.getValue('b') as Block;
    const [, conn] = makeLocalConnection(Root.instance, true, undefined, false);
    let activeStage: DesignerStageContextValue;
    let context: TicloCurrentFlow;
    function PanelProbe() {
      activeStage = useActiveDesignerStage();
      context = useContext(TicloCurrentFlowContext);
      return <DesignerNodeTree />;
    }
    const [, div] = loadTemplate(
      <StrictMode>
        <DesignerApp value={{}}>
          <DesignerStage root={Root.instance} conn={conn} basePath={path} />
          <DesignerStage root={Root.instance} conn={conn} basePath={secondPath} />
          <div style={{height: 300}}>
            <PanelProbe />
          </div>
        </DesignerApp>
      </StrictMode>,
      'editor'
    );
    const tree = () => div.querySelector('.ticl-d-node-tree') as HTMLElement;
    const selected = () =>
      Array.from(tree().querySelectorAll('.ticl-e-tree-node-selected .ticl-e-tree-node-text')).map(
        (node) => node.textContent
      );
    await shouldHappen(() => activeStage?.basePath === secondPath && tree().querySelector('.ticl-e-tree-node'));
    context.onFlowFocus(path);
    await shouldHappen(() => activeStage?.main === main && tree().querySelectorAll('.ticl-e-tree-node').length === 1);
    await shouldHappen(() => tree().querySelector('.tico-fab-react'));
    main.setValue('#is', 'add');
    await shouldHappen(() => tree().querySelector('.tico-fas-plus'));
    main.setValue('#is', 'react:div');
    await shouldHappen(() => tree().querySelector('.tico-fab-react'));
    (tree().querySelector('.ticl-e-tree-arr') as HTMLElement).click();
    await shouldHappen(() => querySingle("//div.ticl-e-tree-node-text[text()='b']", tree()));
    expect(querySingle("//div.ticl-e-tree-node-text[text()='outside']", tree())).toBeNull();

    const page = div.querySelector('.ticl-d-page');
    const [first, second] = page.querySelectorAll('p');
    first.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
    first.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
    second.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, ctrlKey: true}));
    second.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, ctrlKey: true}));
    await shouldHappen(() => activeStage.selection.blocks.length === 2 && selected().length === 2);
    expect(activeStage.selection).toEqual({blocks: [a, b], paths: [`${path}.#main.a`, `${path}.#main.b`]});
    second.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, ctrlKey: true}));
    second.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, ctrlKey: true}));
    await shouldHappen(() => activeStage.selection.blocks.length === 1 && selected().length === 1);
    expect(activeStage.selection.blocks).toEqual([a]);
    page.querySelector('div').dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
    page.querySelector('div').dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
    await shouldHappen(
      () =>
        activeStage.selection.blocks[0] === main &&
        tree().querySelector('.ticl-e-tree-node-selected .ticl-e-tree-node-text[title="#main"]')
    );

    context.activeStage.select([`${path}.#main.a`]);
    await shouldHappen(() => selected().includes('a'));
    expect(activeStage.selection).toEqual({blocks: [a], paths: [`${path}.#main.a`]});
    querySingle("//div.ticl-e-tree-node-text[text()='b']", tree()).click();
    await shouldHappen(() => activeStage.selection.blocks[0] === b);
    expect(activeStage.selection.paths).toEqual([`${path}.#main.b`]);
    querySingle("//div.ticl-e-tree-node-text[text()='a']", tree()).dispatchEvent(
      new MouseEvent('click', {bubbles: true, ctrlKey: true})
    );
    await shouldHappen(() => activeStage.selection.blocks.length === 2);
    expect(activeStage.selection).toEqual({blocks: [b, a], paths: [`${path}.#main.b`, `${path}.#main.a`]});

    main.deleteValue('b');
    await shouldHappen(() => activeStage.selection.blocks.length === 1 && activeStage.selection.blocks[0] === a);
    expect(activeStage.selection.paths).toEqual([`${path}.#main.a`]);
    await shouldHappen(() => !querySingle("//div.ticl-e-tree-node-text[text()='b']", tree()));
    main.deleteValue('a');
    const replacementChild = main.createBlock('a');
    replacementChild.setValue('#is', 'react:span');
    replacementChild.setValue('@b-name', 'Replacement A');
    await shouldHappen(() => tree().textContent.includes('Replacement A'));
    expect(activeStage.selection).toEqual({blocks: [], paths: []});
    activeStage.select([`${path}.outside`, `${path}.missing`]);
    await shouldHappen(() => activeStage.selection.paths.length === 0);
    activeStage.select([main, main]);
    await shouldHappen(() => activeStage.selection.blocks.length === 1);
    context.onFlowFocus(secondPath);
    await shouldHappen(() => activeStage?.basePath === secondPath && selected().length === 0);
    expect(querySingle("//div.ticl-e-tree-node-text[text()='a']", tree())).toBeNull();
    activeStage.select([`${secondPath}.#main`]);
    await shouldHappen(() => activeStage.selection.paths.length === 1);
    context.onFlowFocus(path);
    await shouldHappen(() => activeStage?.main === main && selected().length === 1);
    expect(activeStage.selection).toEqual({blocks: [main], paths: [`${path}.#main`]});

    flow.deleteValue('#main');
    await shouldHappen(() => activeStage.main === null && activeStage.selection.paths.length === 0);
    expect(tree().querySelector('.ticl-e-tree-node')).toBeNull();
    const replacement = flow.createBlock('#main');
    replacement.setValue('#is', 'react:p');
    await shouldHappen(
      () => activeStage.main === replacement && tree().querySelectorAll('.ticl-e-tree-node').length === 1
    );
    expect(activeStage.selection.blocks).toEqual([]);
  });
});
