import React from 'react';
import {vi, type Mock} from 'vitest';
import {Root, PropDispatcher} from '@ticlo/core';
import {makeLocalConnection, destroyLastLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '@ticlo/editor';
import {loadTemplate, removeLastTemplate, querySingle} from '@ticlo/editor/util/test-util.ts';
import {DesignerApp} from '../DesignerApp.tsx';
import {DesignerNavigationTree, DesignerNodeTree} from '../DesignerNodeTree.tsx';
import {DesignerStage} from '../DesignerStage.tsx';
import {useActiveDesignerStage, type DesignerStageContextValue} from '../DesignerContext.tsx';

describe('designer tree open actions', () => {
  const path = 'DesignerTreeOpen';
  let designFlow: Mock<(path: string, onSave: () => void) => void>;
  let editFlow: Mock<(path: string, onSave: () => void) => void>;
  let stage: DesignerStageContextValue;
  let div: HTMLElement;

  beforeEach(async () => {
    await initEditor();
    Root.instance.addFlow(path, {
      '#main': {
        '#is': 'react:div',
        '#order': ['button'],
        'button': {'#is': 'react:button', 'content': 'Click'},
      },
    });
    const [, conn] = makeLocalConnection(Root.instance);
    designFlow = vi.fn();
    editFlow = vi.fn();
    const selection = new PropDispatcher<string[]>();
    function Panel(): null {
      stage = useActiveDesignerStage();
      return null;
    }
    [, div] = loadTemplate(
      <DesignerApp value={{designFlow, editFlow, getSelectedPaths: () => selection}}>
        <div className="navigation" style={{width: 300, height: 300}}>
          <DesignerNavigationTree conn={conn} basePaths={[path]} />
        </div>
        <DesignerStage root={Root.instance} conn={conn} basePath={path} />
        <div className="outline" style={{width: 300, height: 300}}>
          <DesignerNodeTree />
        </div>
        <Panel />
      </DesignerApp>,
      'editor'
    );
    await shouldHappen(() => stage && row('navigation', path));
    stage.select([`${path}.#main.button`]);
    await shouldHappen(() => row('outline', 'button'));
  });

  afterEach(() => {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue(path);
    stage = null;
  });

  function row(tree: string, name: string) {
    return querySingle(`//div.ticl-e-tree-node-text[text()='${name}']/..`, div.querySelector(`.${tree}`));
  }

  async function menu(tree: string, name: string) {
    row(tree, name).dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, button: 2, clientX: 30, clientY: 30}));
    const popup = (await shouldHappen(() =>
      document.querySelector('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden)')
    )) as HTMLElement;
    return Array.from(popup.querySelectorAll<HTMLElement>('.ticl-e-dropdown-menu-item'));
  }

  it('defaults navigation double-click to Design', () => {
    row('navigation', path).dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
    expect(designFlow).toHaveBeenCalledTimes(1);
    expect(designFlow.mock.calls[0][0]).toBe(path);
    expect(editFlow).not.toHaveBeenCalled();
  });

  it('defaults component-node double-click to Open Flow', () => {
    row('outline', 'button').dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
    expect(editFlow).toHaveBeenCalledTimes(1);
    expect(editFlow.mock.calls[0]).toEqual([`${path}.#main.button`, null]);
    expect(designFlow).not.toHaveBeenCalled();
  });

  it.each(['navigation', 'outline'])('offers both actions in the %s menu and can choose Design', async (tree) => {
    const name = tree === 'navigation' ? path : 'button';
    const items = await menu(tree, name);
    expect(items.map((item) => item.textContent)).toEqual(expect.arrayContaining(['Design', 'Open Flow']));
    items.find((item) => item.textContent === 'Design').click();
    expect(designFlow).toHaveBeenCalledTimes(1);
    expect(designFlow.mock.calls[0][0]).toBe(tree === 'navigation' ? path : `${path}.#main.button`);
    expect(editFlow).not.toHaveBeenCalled();
  });

  it.each(['navigation', 'outline'])('can choose Open Flow from the %s menu', async (tree) => {
    const name = tree === 'navigation' ? path : 'button';
    const items = await menu(tree, name);
    items.find((item) => item.textContent === 'Open Flow').click();
    expect(editFlow).toHaveBeenCalledTimes(1);
    expect(editFlow.mock.calls[0][0]).toBe(tree === 'navigation' ? path : `${path}.#main.button`);
    expect(designFlow).not.toHaveBeenCalled();
  });
});
