import {expect, vi} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {ConfigProvider} from 'antd';
import {simulate} from 'simulate-event';
import React from 'react';
import {BlockStage} from '../BlockStage.tsx';
import {type Flow, Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen, shouldReject} from '@ticlo/core/util/test-util.ts';
import {removeLastTemplate, loadTemplate, querySingle} from '../../util/test-util.ts';
import {initEditor, PropertyList} from '../../index.ts';
import {theme} from '../../style/theme.ts';
import {TicloLayoutContextType} from '../../component/LayoutContext.ts';

describe('editor Block Field', function () {
  let flow: Flow;

  beforeEach(async function () {
    await initEditor();
  });

  afterEach(function () {
    removeLastTemplate();
    destroyLastLocalConnection();
    if (flow) {
      Root.instance.deleteValue(flow.getName());
      flow = null;
    }
  });

  it('single block', async function () {
    flow = Root.instance.addFlow('BlockField1');
    flow.load({
      add: {
        '#is': '',
        'a': 1,
        'b': 1.333333333333,
        'c': 'ccc',
        'd': true,
        'e': null,
        '@b-xyw': [123, 234, 345],
        '@b-p': ['a', 'b', 'c', 'd', 'e', 'z'],
      },
    });

    const [server, client] = makeLocalConnection(Root.instance);

    const [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockField1" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-e-field'), 1000, 'find fields');

    const block = div.querySelector('.ticl-e-block') as HTMLDivElement;

    await shouldHappen(() => block.querySelectorAll('.ticl-e-field').length === 6);

    await shouldHappen(() =>
      querySingle("//div.ticl-e-field-name/span[text()='a']/..//../../div.ticl-e-field-value[text()='1']", div)
    );
    expect(
      querySingle("//div.ticl-e-field-name/span[text()='b']/..//../../div.ticl-e-field-value[text()='1.333']", div)
    ).not.toBeNull();
    expect(
      querySingle(
        "//div.ticl-e-field-name/span[text()='c']/..//../../div.ticl-e-field-value/span.ticl-e-string-value[text()='ccc']",
        div
      )
    ).not.toBeNull();
    expect(
      querySingle("//div.ticl-e-field-name/span[text()='d']/..//../../div.ticl-e-field-value[text()='true']", div)
    ).not.toBeNull();
    expect(
      querySingle("//div.ticl-e-field-name/span[text()='e']/..//../../div.ticl-e-field-value[text()='null']", div)
    ).not.toBeNull();
    expect(
      querySingle("//div.ticl-e-field-name/span[text()='z']/..//../../div.ticl-e-field-value[not(text())]", div)
    ).not.toBeNull();

    flow.queryProperty('add.c').setValue(3);
    // no longer a string value
    await shouldHappen(() =>
      querySingle(
        "//div.ticl-e-field-name/span[text()='c']/..//../../div.ticl-e-field-value[text()='3'][not(contains(@class,'ticl-e-string-value'))]",
        div
      )
    );
  });

  it('toggles inline editing and uses the stage descriptor on the same property', async () => {
    const basePath = 'BlockFieldInline';
    const path = `${basePath}.block`;
    flow = Root.instance.addFlow(basePath, {
      block: {
        '#is': '',
        '#custom': [{name: 'input', type: 'string'}],
        'input': 'abc',
        'source': 'bound',
        '@b-xyw': [100, 100, 240],
        '@b-p': ['input'],
      },
    });
    const [, conn] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(
      <>
        <BlockStage conn={conn} basePath={basePath} />
        <PropertyList conn={conn} paths={[path]} />
      </>,
      'editor'
    );
    const stageInput = () => div.querySelector<HTMLInputElement>('.ticl-e-inline-value input');
    const fieldName = await shouldHappen(() => div.querySelector('.ticl-e-field-name > span'));
    simulate(fieldName, 'contextmenu', {button: 2});
    const checkbox = await shouldHappen(() => {
      const labels = document.querySelectorAll<HTMLLabelElement>('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden) label');
      const label = [...labels].find((label) => label.textContent.includes('Inline'));
      const input = label?.querySelector('input');
      return input && !input.disabled && input;
    });
    checkbox.click();
    const input = await shouldHappen(stageInput);
    expect(flow.queryValue('block.@b-inline')).toEqual({input: true});
    await userEvent.fill(page.elementLocator(input), 'from stage');
    simulate(input, 'keydown', {key: 'Enter'});
    await shouldHappen(() => flow.queryValue('block.input') === 'from stage');

    await conn.setValue(`${path}.@b-inline`, {input: {type: 'select', options: ['from stage', 'second']}}, true);
    await shouldHappen(() => div.querySelector('.ticl-e-inline-value .ant-select'));
    expect(div.querySelector('.ticl-e-property-list textarea')).not.toBeNull();
    await conn.setBinding(`${path}.input`, 'source', false, true);
    await shouldHappen(() => !div.querySelector('.ticl-e-inline-value'));
    expect(div.querySelector('.ticl-e-field-value').textContent).toContain('bound');
  });

  it('fits inline controls and their expand buttons inside a single stage row', async () => {
    const basePath = 'BlockFieldInlineHeight';
    const options = ['Apple', 'Banana', 'Cherry', 'Durian'];
    flow = Root.instance.addFlow(basePath, {
      block: {
        '#is': '',
        '#custom': [
          {name: 'text', type: 'string'},
          {name: 'dynamic', type: 'any'},
          {name: 'choices', type: 'multi-select', options},
          {name: 'number', type: 'number', unit: 'ms'},
        ],
        'text': 'first line\nsecond line',
        'dynamic': 'dynamic text',
        'choices': options,
        'number': 1,
        '@b-xyw': [100, 100, 200],
        '@b-p': ['text', 'dynamic', 'choices', 'number'],
        '@b-inline': {text: true, dynamic: true, choices: true, number: true},
      },
    });
    const [, conn] = makeLocalConnection(Root.instance);
    const editValue = vi.fn();
    const [, div] = loadTemplate(
      <ConfigProvider theme={theme}>
        <div className="css-var-r0">
          <TicloLayoutContextType.Provider value={{editValue}}>
            <BlockStage conn={conn} basePath={basePath} />
          </TicloLayoutContextType.Provider>
        </div>
      </ConfigProvider>,
      'editor'
    );
    await shouldHappen(() => div.querySelector('.ticl-e-inline-value .ant-select-selection-item'));
    const input = div.querySelector<HTMLInputElement>('.ticl-e-inline-value input');
    await shouldHappen(
      () =>
        getComputedStyle(input.closest('.ticl-e-field')).display === 'flex' &&
        getComputedStyle(div.querySelector('.ticl-e-inline-value .ant-select-content')).display === 'flex'
    );
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe('first line…');
    expect(div.querySelector('.ticl-e-inline-value .ant-select-selection-item').textContent).toBe('+4');
    const rows = div.querySelectorAll('.ticl-e-inline-value');
    expect(rows.length).toBe(4);
    const buttons = div.querySelectorAll('.ticl-e-inline-value .ticl-e-expand-button');
    expect(buttons.length).toBe(2);
    for (const button of buttons) {
      const value = button.closest('.ticl-e-inline-value').getBoundingClientRect();
      const field = button.closest('.ticl-e-field').getBoundingClientRect();
      const bounds = button.getBoundingClientRect();
      expect(bounds.left).toBeGreaterThanOrEqual(value.right);
      expect(bounds.right).toBeLessThanOrEqual(field.right);
      expect(
        document
          .elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
          ?.closest('.ticl-e-expand-button')
      ).toBe(button);
    }
    expect(input.getBoundingClientRect().right).toBe(rows[0].getBoundingClientRect().right);
    for (const row of rows) {
      expect(row.parentElement.getBoundingClientRect().height).toBe(24);
      expect(row.firstElementChild.getBoundingClientRect().height).toBeLessThanOrEqual(22);
    }
    await userEvent.click(buttons[0]);
    await shouldHappen(() => editValue.mock.calls.length === 1);
    expect(editValue.mock.calls[0][0]).toBe('first line\nsecond line');
  });

  it('sub block', async function () {
    flow = Root.instance.addFlow('BlockField2');
    flow.load({
      add: {
        '#is': 'add',
        '0': 1,
        '@b-xyw': [100, 100, 143],
        '@b-p': ['0'],
      },
      subtract: {
        '#is': 'subtract',
        '~0': {
          '#is': 'add',
          '0': 1,
          '~1': '##.##.add.0',
          '@b-p': ['0', '1'],
        },
        '@b-xyw': [120, 280, 143],
        '@b-p': ['0'],
      },
    });

    const [server, client] = makeLocalConnection(Root.instance);

    const [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockField2" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-e-block'));

    const subtractBlock = querySingle("//div.ticl-e-block-head.ticl-e-block-head-label[text()='subtract']/../..", div);

    await shouldHappen(() => subtractBlock.querySelectorAll('.ticl-e-field').length === 3);

    const fieldNames = subtractBlock.querySelectorAll('.ticl-e-field-name');
    expect(fieldNames[0].querySelector(':scope > span')?.textContent).toBe('0');
    // property from sub blocks
    expect(fieldNames[1].querySelector(':scope > span')?.textContent).toBe('0');
    expect(fieldNames[2].querySelector(':scope > span')?.textContent).toBe('1');

    // hide sub block
    simulate(fieldNames[0], 'dblclick');

    await shouldHappen(() => subtractBlock.querySelectorAll('.ticl-e-field').length === 1);
    // wire should still exists
    expect(document.querySelector('svg')).not.toBeNull();

    // show sub block again
    simulate(fieldNames[0], 'dblclick');

    await shouldHappen(() => subtractBlock.querySelectorAll('.ticl-e-field').length === 3);
  });

  it('reorders fields with the right button without opening a menu', async () => {
    const flow = Root.instance.addFlow('BlockFieldReorderMenu', {
      block: {'#is': '', 'a': 1, 'b': 2, '@b-xyw': [100, 100, 200], '@b-p': ['a', 'b']},
    });
    const [, client] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(<BlockStage conn={client} basePath="BlockFieldReorderMenu" />, 'editor');
    try {
      await shouldHappen(() => div.querySelectorAll('.ticl-e-field-name > span').length === 2);
      const [source, target] = div.querySelectorAll('.ticl-e-field-name > span');
      const from = source.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const down = {button: 2, buttons: 2, clientX: from.x + from.width / 2, clientY: from.y + from.height / 2};
      const move = {button: 2, buttons: 2, clientX: to.x + to.width / 2, clientY: to.y + to.height / 2};
      simulate(source, 'mousedown', down);
      simulate(source, 'contextmenu', down);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(document.querySelector('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden)')).toBeNull();
      simulate(target, 'mousemove', move);
      expect(document.querySelector('.ticl-e-drag-wire')).toBeNull();
      simulate(target, 'mouseup', {...move, buttons: 0});
      simulate(target, 'contextmenu', {...move, buttons: 0});
      await shouldHappen(() => (flow.queryValue('block.@b-p') as string[])[0] === 'b');
      // Wait for the reorder response before tearing down the connection.
      await client.getValue('BlockFieldReorderMenu.block.@b-p');
      expect(flow.queryValue('block.@b-p')).toEqual(['b', 'a']);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      expect(document.querySelector('.ticl-e-dropdown:not(.ticl-e-dropdown-hidden)')).toBeNull();
    } finally {
      Root.instance.deleteValue('BlockFieldReorderMenu');
    }
  });

  it('indirect binding', async function () {
    flow = Root.instance.addFlow('BlockField3');
    flow.load({
      add: {
        '#is': 'add',
        '0': {a: 3},
        '@b-xyw': [100, 100, 143],
        '@b-p': ['0'],
      },
      subtract: {
        '#is': 'subtract',
        '~0': '##.add.0.a',
        '@b-xyw': [260, 124, 143],
        '@b-p': ['0'],
      },
    });

    const [server, client] = makeLocalConnection(Root.instance);

    const [component, div] = loadTemplate(
      <BlockStage conn={client} basePath="BlockField3" style={{width: '800px', height: '800px'}} />,
      'editor'
    );

    await shouldHappen(() => div.querySelector('.ticl-e-block-wire'));

    const wire = div.querySelector('.ticl-e-block-wire');

    // indirect binding should have dash style
    expect(wire.classList.contains('ticl-e-wire-dash')).toBe(true);

    // switch to direct binding
    flow.queryProperty('subtract.0').setBinding('##.add.0');

    await shouldHappen(() => !wire.classList.contains('ticl-e-wire-dash'));
  });

  it.each([true, false])(
    'uses the footer only for block bindings (source already mounted: %s)',
    async (sourceFirst) => {
      const source = {
        '#is': '',
        'data': {value: 3},
        '@b-xyw': [100, 100, 143],
        '@b-p': [] as string[],
      };
      const target = {
        '#is': '',
        '~value': '##.source.data.value',
        '@b-xyw': [300, 100, 143],
        '@b-p': ['value'],
      };
      flow = Root.instance.addFlow('BlockFieldFooter');
      flow.load(sourceFirst ? {source, target} : {target});

      const [, client] = makeLocalConnection(Root.instance);
      const stage = React.createRef<BlockStage>();
      const [, div] = loadTemplate(<BlockStage ref={stage} conn={client} basePath="BlockFieldFooter" />, 'editor');
      await shouldHappen(
        () => stage.current?.getBlock('BlockFieldFooter.target')?.fieldItems.get('value')?._bindingTargetPath
      );
      if (!sourceFirst) await client.addBlock('BlockFieldFooter.source', source);

      await shouldHappen(() => div.querySelectorAll('.ticl-e-block').length === 2);
      await shouldHappen(
        () => stage.current.getBlock('BlockFieldFooter.target').fieldItems.get('value').cache.value === 3
      );
      expect(div.querySelector('.ticl-e-block-wire')).toBeNull();
      expect(div.querySelector('.ticl-e-block-foot > .ticl-e-outbound')).toBeNull();

      flow.queryProperty('source.@b-p').setValue(['data']);
      await shouldHappen(() => div.querySelector('.ticl-e-wire-dash'));
      expect(div.querySelector('.ticl-e-block-foot > .ticl-e-outbound')).toBeNull();

      flow.queryProperty('source.@b-p').setValue([]);
      await shouldHappen(() => !div.querySelector('.ticl-e-block-wire'));

      flow.queryProperty('target.value').setBinding('##.source');
      await shouldHappen(() => div.querySelector('.ticl-e-block-wire'));
      expect(div.querySelector('.ticl-e-wire-dash')).toBeNull();
      expect(div.querySelector('.ticl-e-block-foot > .ticl-e-outbound')).not.toBeNull();

      flow.queryProperty('target.value').setBinding('##.source.data.value');
      await shouldHappen(() => !div.querySelector('.ticl-e-block-wire'));
      expect(div.querySelector('.ticl-e-block-foot > .ticl-e-outbound')).toBeNull();
    }
  );
});
