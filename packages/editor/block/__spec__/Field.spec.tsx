import {expect, vi} from 'vitest';
import {page, userEvent} from 'vitest/browser';
import {ConfigProvider} from 'antd';
import {DockLayout} from 'rc-dock';
import {flushSync} from 'react-dom';
import {simulate} from 'simulate-event';
import React from 'react';
import {BlockStage} from '../BlockStage.tsx';
import {EditPolicyProvider} from '../../component/EditPolicyContext.tsx';
import {type Flow, PureFunction, Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen, shouldReject} from '@ticlo/core/util/test-util.ts';
import {fakeMouseEvent, removeLastTemplate, loadTemplate, querySingle} from '../../util/test-util.ts';
import {initEditor, PropertyList} from '../../index.ts';
import {theme} from '../../style/theme.ts';
import {TicloLayoutContextType} from '../../component/LayoutContext.ts';
import {SchedulePane} from '../../dock/schedule/SchedulePane.tsx';
import {TableEditor} from '../../property/value/TableEditor.tsx';
import {defaultWorkerData} from '@ticlo/core/defaults/DefaultFlows.ts';
import '@ticlo/html/functions/CreateStyle.ts';

async function selectOption(label: string) {
  const option = await shouldHappen(() =>
    [
      ...document.querySelectorAll(
        '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content'
      ),
    ].find((element) => element.textContent === label)
  );
  await userEvent.click(page.elementLocator(option));
}

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

  it('creates embedded Blocks inline and displays their bound values without inline editors', async () => {
    const basePath = 'BlockFieldInlineHelper';
    const items = [{label: 'x'.repeat(3000)}, {label: 'second'}];
    flow = Root.instance.addFlow(basePath, {
      block: {
        '#is': '',
        '#custom': [
          {name: 'auth', type: 'object', create: ['auth:password']},
          {name: 'style', type: 'object', create: 'html:create-style'},
          {name: 'items', type: 'array', create: ':array-helper'},
          {name: 'dynamic', type: 'any', types: ['array'], create: [':array-helper']},
        ],
        items,
        '@b-xyw': [100, 100, 250],
        '@b-p': ['auth', 'style', 'items', 'dynamic'],
        '@b-inline': {auth: true, style: true, items: true, dynamic: true},
      },
    });
    class ArrayHelper extends PureFunction {
      run() {
        this._data.output(this._data.getValue('input'));
      }
    }
    flow.getFuncModule().addFactory(ArrayHelper, {
      id: ':array-helper',
      name: 'array-helper',
      recipient: 'input',
      properties: [
        {name: 'input', type: 'array'},
        {name: '#output', type: 'array', readonly: true},
      ],
    });
    const [, conn] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(<BlockStage conn={conn} basePath={basePath} funcModule={basePath} />, 'editor');
    const field = (name: string) =>
      [...div.querySelectorAll('.ticl-e-field-inline')].find(
        (row) => row.querySelector('.ticl-e-field-name')?.textContent === name
      );
    const click = async (name: string, selector: string) => {
      const control = await shouldHappen(() => field(name)?.querySelector<HTMLElement>(selector));
      await userEvent.click(page.elementLocator(control));
    };
    await click('auth', '.ant-select:not(.ant-select-disabled)');
    await selectOption('password');
    await shouldHappen(() => flow.queryProperty('block.auth')._bindingPath === '~auth.#output');
    expect(flow.queryValue('block.auth')).toEqual({authMode: 'password', showSecret: true});

    await click('style', 'button:not(:disabled)');
    await shouldHappen(() => flow.queryProperty('block.style')._bindingPath === '~style.#output');

    await click('dynamic', '.ant-select:not(.ant-select-disabled)');
    await selectOption('array-helper');
    await shouldHappen(() => flow.queryValue('block.~dynamic.#is') === ':array-helper');

    await click('items', '.ticl-e-object-convert-button');
    await page.getByText('Convert to :array-helper', {exact: true}).click();
    await shouldHappen(() => flow.queryProperty('block.items')._bindingPath === '~items.#output');
    expect(flow.queryValue('block.~items.input')).toEqual(items);
    expect(flow.queryValue('block.items')).toEqual(items);
    await shouldHappen(() => div.querySelectorAll('.ticl-e-field-inline').length === 0);
  });

  it('uses an inline service picker only while the service is unbound', async () => {
    const basePath = 'BlockFieldInlineService';
    flow = Root.instance.addFlow(basePath, {
      block: {
        '#is': '',
        '#custom': [{name: 'client', type: 'service', options: ['http-client']}],
        '@b-xyw': [100, 100, 250],
        '@b-p': ['client'],
        '@b-inline': {client: true},
      },
    });
    const [, conn] = makeLocalConnection(Root.instance);
    const globalSource = '^inline-http';
    const flowSource = '^flow-http';
    try {
      await conn.addBlock(`#global.${globalSource}`, {'#is': 'http:client'});
      const [, div] = loadTemplate(<BlockStage conn={conn} basePath={basePath} />, 'editor');
      const picker = () => div.querySelector<HTMLElement>('.ticl-e-inline-value .ant-select');
      const service = await shouldHappen(picker);
      await userEvent.click(page.elementLocator(service));
      await selectOption(globalSource);
      await shouldHappen(() => flow.queryProperty('block.client')?._bindingPath === `${globalSource}.#output`);
      await shouldHappen(() => div.querySelector('.ticl-e-field-value:not(.ticl-e-inline-value)'));
      await conn.setBinding(`${basePath}.block.client`, null, true, true);
      await conn.addBlock(`${basePath}.${flowSource}`, {'#is': 'http:client'});
      const restoredPicker = await shouldHappen(picker);
      await userEvent.click(page.elementLocator(restoredPicker));
      await selectOption(flowSource);
      await shouldHappen(() => flow.queryProperty('block.client')?._bindingPath === `${flowSource}.#output`);
    } finally {
      await conn.deleteBlock(`#global.${globalSource}`);
    }
  });

  it('fits inline controls in a single stage row and shows action buttons outside on hover', async () => {
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
    const block = div.querySelector('.ticl-e-block');
    const blockBounds = block.getBoundingClientRect();
    const rows = div.querySelectorAll('.ticl-e-inline-value');
    expect(rows.length).toBe(4);
    const expandButtons = div.querySelectorAll<HTMLElement>('.ticl-e-inline-value .ticl-e-expand-button');
    const typeButton = div.querySelector<HTMLElement>('.ticl-e-inline-value .ticl-e-dynamic-type-icon');
    expect(expandButtons.length).toBe(2);
    expect(typeButton).not.toBeNull();

    // No reserved width inside the block, including inside the dynamic editor.
    expect(input.getBoundingClientRect().right).toBe(rows[0].getBoundingClientRect().right);
    const dynamicInput = rows[1].querySelector<HTMLInputElement>('input');
    expect(dynamicInput.getBoundingClientRect().right).toBe(rows[1].getBoundingClientRect().right);
    for (const row of rows) {
      const field = row.parentElement;
      expect(row.getBoundingClientRect().right).toBe(field.getBoundingClientRect().right);
      expect(field.getBoundingClientRect().height).toBe(24);
      expect(row.firstElementChild.getBoundingClientRect().height).toBeLessThanOrEqual(22);
    }

    // Small action buttons are hidden by default.
    for (const button of [...expandButtons, typeButton]) {
      expect(getComputedStyle(button).visibility).toBe('hidden');
      const bounds = button.getBoundingClientRect();
      expect(
        document
          .elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
          ?.closest('.ticl-e-expand-button, .ticl-e-dynamic-type-icon')
      ).toBeNull();
    }

    // Hovering the text row reveals only its expand button outside the block boundary.
    await userEvent.hover(page.elementLocator(rows[0].parentElement));
    await shouldHappen(() => getComputedStyle(expandButtons[0]).visibility === 'visible');
    expect(getComputedStyle(expandButtons[1]).visibility).toBe('hidden');
    expect(getComputedStyle(typeButton).visibility).toBe('hidden');
    const firstBounds = expandButtons[0].getBoundingClientRect();
    expect(firstBounds.left).toBeGreaterThanOrEqual(blockBounds.right);
    expect(
      document
        .elementFromPoint(firstBounds.x + firstBounds.width / 2, firstBounds.y + firstBounds.height / 2)
        ?.closest('.ticl-e-expand-button')
    ).toBe(expandButtons[0]);

    await userEvent.click(expandButtons[0]);
    await shouldHappen(() => editValue.mock.calls.length === 1);
    expect(editValue.mock.calls[0][0]).toBe('first line\nsecond line');

    // Hovering the dynamic row shows the type button aligned directly above the expand button outside the block.
    await userEvent.hover(page.elementLocator(rows[1].parentElement));
    await shouldHappen(
      () =>
        getComputedStyle(typeButton).visibility === 'visible' &&
        getComputedStyle(expandButtons[1]).visibility === 'visible'
    );
    expect(getComputedStyle(expandButtons[0]).visibility).toBe('hidden');
    const typeBounds = typeButton.getBoundingClientRect();
    const dynamicExpandBounds = expandButtons[1].getBoundingClientRect();
    expect(typeBounds.left).toBeGreaterThanOrEqual(blockBounds.right);
    expect(typeBounds.left).toBe(dynamicExpandBounds.left);
    expect(typeBounds.right).toBe(dynamicExpandBounds.right);
    expect(typeBounds.bottom).toBeLessThanOrEqual(dynamicExpandBounds.top);
    expect(
      document
        .elementFromPoint(typeBounds.x + typeBounds.width / 2, typeBounds.y + typeBounds.height / 2)
        ?.closest('.ticl-e-dynamic-type-icon')
    ).toBe(typeButton);

    // Clicking the dynamic type button opens the menu and switches the inline editor type.
    await userEvent.click(typeButton);
    const numberItem = await shouldHappen(() =>
      [...document.querySelectorAll('.ant-dropdown-menu-item')].find((el) => el.textContent?.includes('number'))
    );
    await userEvent.click(numberItem);
    await shouldHappen(() => rows[1].querySelector('.ticl-e-number-input'));

    await userEvent.unhover(page.elementLocator(rows[1].parentElement));
    await shouldHappen(() => getComputedStyle(typeButton).visibility === 'hidden');
  });

  it('opens and saves worker, table and schedule edits from inline fields', async () => {
    const basePath = 'BlockFieldInlinePanels';
    flow = Root.instance.addFlow(basePath, {
      block: {
        '#is': '',
        '#custom': [
          {name: 'run', type: 'worker'},
          {name: 'rows', type: 'table', columns: [{key: 'label', type: 'string'}]},
        ],
        'run': {'#is': defaultWorkerData},
        'rows': [{label: 'Before'}],
        '@b-xyw': [100, 100, 260],
        '@b-p': ['run', 'rows'],
        '@b-inline': {run: true, rows: true},
      },
      schedule: {
        '#is': 'scheduler',
        'config0': {start: '09:00', duration: 60, repeat: 'daily'},
        '@b-xyw': [400, 100, 260],
        '@b-p': ['config0'],
        '@b-inline': {config0: true},
      },
    });
    const [, conn] = makeLocalConnection(Root.instance);
    let layout: DockLayout;
    const editFlow = vi.fn();
    const [, div] = loadTemplate(
      <TicloLayoutContextType.Provider
        value={{
          editFlow,
          editTable: (props) => TableEditor.openFloatPanel(layout, props),
          editSchedule: (path, name, index, unbound) =>
            SchedulePane.openFloatPanel(layout, conn, path, name, index, unbound),
        }}
      >
        <DockLayout
          ref={(value) => {
            layout = value;
          }}
          defaultLayout={{
            dockbox: {
              mode: 'horizontal',
              children: [
                {tabs: [{id: 'stage', title: 'Stage', content: <BlockStage conn={conn} basePath={basePath} />}]},
              ],
            },
          }}
          style={{width: 950, height: 700}}
        />
      </TicloLayoutContextType.Provider>,
      'editor'
    );
    const worker = await shouldHappen(() => div.querySelector('.ticl-e-inline-value button:has(.anticon-edit)'));
    await userEvent.click(page.elementLocator(worker));
    await shouldHappen(() => editFlow.mock.calls.length === 1);
    const [workerPath, saveWorker] = editFlow.mock.calls[0];
    await conn.setValue(`${workerPath}.marker`, 'saved', true);
    saveWorker();
    await shouldHappen(() => (flow.queryValue('block.run') as {marker?: string})?.marker === 'saved');

    await page.getByText('Edit table', {exact: true}).click();
    const cell = await shouldHappen(() => div.querySelector('.ticl-e-table-editor .ticl-e-table-cell-display'));
    await userEvent.click(page.elementLocator(cell));
    const input = await shouldHappen(() => div.querySelector('.ticl-e-table-editor textarea'));
    await userEvent.fill(page.elementLocator(input), 'After');
    await page.getByRole('button', {name: 'OK', exact: true}).click();
    await shouldHappen(() => (flow.queryValue('block.rows') as {label: string}[])[0].label === 'After');

    const calendar = await shouldHappen(() => div.querySelector('.ticl-e-inline-value button:has(.anticon-calendar)'));
    await userEvent.click(page.elementLocator(calendar));
    const repeat = await shouldHappen(() =>
      [...div.querySelectorAll('.ticl-e-schedule-side .ticl-e-property')]
        .find((row) => row.querySelector('.ticl-e-property-name')?.textContent.toLowerCase() === 'repeat')
        ?.querySelector('.ant-select')
    );
    await userEvent.click(page.elementLocator(repeat));
    await selectOption('weekly');
    await shouldHappen(() => (flow.queryValue('schedule.config0') as {repeat: string}).repeat === 'weekly');
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

  it('applies @b-label-w as fixed pixel width across rows and edits it in Misc', async () => {
    const basePath = 'BlockFieldLabelW';
    const blockPath = `${basePath}.block`;
    flow = Root.instance.addFlow(basePath, {
      block: {
        '#is': '',
        '#custom': [
          {name: 'alpha', type: 'string'},
          {name: 'beta', type: 'number'},
        ],
        'alpha': 'hello',
        'beta': 1,
        '~beta': {'#is': 'add', '0': 2, '@b-p': ['0']},
        '@b-xyw': [40, 40, 220],
        '@b-p': ['alpha', 'beta'],
        '@b-inline': {alpha: true},
        '@b-label-w': 60,
      },
      val: {
        '#is': 'value',
        '#hideLabels': true,
        '#custom': [{name: 'value', type: 'number'}],
        'value': 9,
        '@b-xyw': [40, 200, 160],
        '@b-p': ['value'],
        '@b-label-w': 60,
      },
    });
    const [, conn] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(
      <div style={{display: 'flex'}}>
        <BlockStage conn={conn} basePath={basePath} style={{width: 240, height: 320, position: 'relative'}} />
        <PropertyList conn={conn} paths={[blockPath]} style={{width: 150}} />
      </div>,
      'editor'
    );

    const blockEl: HTMLElement = await shouldHappen(() => div.querySelector('.ticl-e-block.ticl-e-block-fixed-label'));
    await shouldHappen(() => blockEl.querySelectorAll('.ticl-e-field-name').length === 3);
    const names = [...blockEl.querySelectorAll<HTMLElement>('.ticl-e-field-name')];
    await shouldHappen(() => Math.round(names[0].getBoundingClientRect().width) === 60);
    // All rows (inline and sub-block) align their divider right edge at the same x.
    const dividerX = names[0].getBoundingClientRect().right;
    expect(names[1].getBoundingClientRect().right).toBeCloseTo(dividerX, 0);
    expect(names[2].getBoundingClientRect().right).toBeCloseTo(dividerX, 0);

    // Expanding block width keeps label column fixed at 60px.
    await conn.setValue(`${blockPath}.@b-xyw`, [40, 40, 320]);
    await shouldHappen(() => blockEl.offsetWidth === 320);
    expect(Math.round(names[0].getBoundingClientRect().width)).toBe(60);

    // Value < 8 restores proportional layout.
    await conn.setValue(`${blockPath}.@b-label-w`, 5);
    await shouldHappen(() => !blockEl.classList.contains('ticl-e-block-fixed-label'));

    // Misc section exposes @b-label-w and updates the block.
    const miscExpand = [...div.querySelectorAll('.ticl-e-property-divider')]
      .find((el) => el.textContent?.includes('Misc'))
      ?.querySelector<HTMLElement>('.ticl-e-tree-arr');
    await userEvent.click(page.elementLocator(miscExpand));
    const labelWInput = await shouldHappen(() => {
      const row = [...div.querySelectorAll('.ticl-e-property')].find((el) => {
        const text = el.querySelector('.ticl-e-property-name')?.textContent;
        return text === 'Label Width' || text === '@b-label-w';
      });
      return row?.querySelector<HTMLInputElement>('input');
    });
    await userEvent.fill(page.elementLocator(labelWInput), '80');
    simulate(labelWInput, 'keydown', {key: 'Enter'});
    await shouldHappen(() => flow.queryValue('block.@b-label-w') === 80);
    await shouldHappen(() => Math.round(names[0].getBoundingClientRect().width) === 80);

    // #hideLabels on value block still stretches value to full width even with @b-label-w set.
    const valBlock = div.querySelector('.ticl-e-block-value.ticl-e-block-hide-labels') as HTMLElement;
    expect(valBlock.querySelector('.ticl-e-field-name')).toBeNull();
    expect(valBlock.querySelector<HTMLElement>('.ticl-e-field-value').getBoundingClientRect().width).toBeGreaterThan(
      100
    );
    await conn.getValue(`${blockPath}.@b-label-w`);
  });

  it('resizes label width via Shift+drag on divider, resets below 8px, cancels on Escape, and respects policy', async () => {
    const basePath = 'BlockFieldShiftDrag';
    flow = Root.instance.addFlow(basePath, {
      block: {
        '#is': '',
        '#custom': [{name: 'input', type: 'string'}],
        'input': 'abc',
        'out': '',
        '@b-xyw': [40, 40, 220],
        '@b-p': ['input', 'out'],
        '@b-inline': {input: true},
      },
      target: {
        '#is': '',
        '#custom': [{name: 'a', type: 'string'}],
        '@b-xyw': [40, 160, 143],
        '@b-p': ['a'],
      },
    });
    const [, baseConn] = makeLocalConnection(Root.instance);
    let stage: BlockStage;
    const [, div] = loadTemplate(
      <BlockStage
        ref={(inst) => {
          stage = inst;
        }}
        conn={baseConn}
        basePath={basePath}
        style={{width: 400, height: 350}}
      />,
      'editor'
    );

    const blockEl: HTMLElement = await shouldHappen(() => div.querySelector('.ticl-e-block'));
    const inputField = await shouldHappen(
      () => blockEl.querySelector('.ticl-e-field.ticl-e-field-inline') as HTMLElement
    );
    const nameEl = inputField.querySelector('.ticl-e-field-name') as HTMLElement;
    await shouldHappen(() => nameEl.offsetWidth > 20);

    // Shift+drag near divider on inline row updates live and saves on mouseup (under zoom=2).
    flushSync(() => stage.setState({zoom: 2}));
    const startW = Math.round(nameEl.offsetWidth);
    const rect1 = nameEl.getBoundingClientRect();
    simulate(nameEl, 'mousedown', fakeMouseEvent(rect1.right - 2, rect1.y + 8, {button: 0, shiftKey: true}));
    expect(document.body.style.cursor).toBe('ew-resize');
    simulate(document, 'mousemove', fakeMouseEvent(rect1.right - 2 + 40, rect1.y + 8));
    expect(blockEl.classList.contains('ticl-e-block-fixed-label')).toBe(true);
    expect(blockEl.style.getPropertyValue('--ticl-label-w')).toBe(`${startW + 20}px`);
    // Value wasn't written until mouseup.
    expect(flow.queryValue('block.@b-label-w')).toBeUndefined();
    simulate(document, 'mouseup');
    expect(document.body.style.cursor).toBe('');
    await shouldHappen(() => flow.queryValue('block.@b-label-w') === startW + 20);
    await baseConn.getValue(`${basePath}.block.@b-label-w`);

    flushSync(() => stage.setState({zoom: 1}));

    // Escape cancels and restores previous @b-label-w.
    const rect2 = nameEl.getBoundingClientRect();
    simulate(nameEl, 'mousedown', fakeMouseEvent(rect2.right, rect2.y + 8, {button: 0, shiftKey: true}));
    simulate(document, 'mousemove', fakeMouseEvent(rect2.right + 30, rect2.y + 8));
    expect(blockEl.style.getPropertyValue('--ticl-label-w')).toBe(`${startW + 50}px`);
    simulate(document, 'keydown', {key: 'Escape'});
    expect(blockEl.style.getPropertyValue('--ticl-label-w')).toBe(`${startW + 20}px`);
    expect(flow.queryValue('block.@b-label-w')).toBe(startW + 20);

    // Dragging below 8px resets @b-label-w to undefined.
    const rect3 = nameEl.getBoundingClientRect();
    simulate(nameEl, 'mousedown', fakeMouseEvent(rect3.right, rect3.y + 8, {button: 0, shiftKey: true}));
    simulate(document, 'mousemove', fakeMouseEvent(rect3.right - 200, rect3.y + 8));
    expect(blockEl.classList.contains('ticl-e-block-fixed-label')).toBe(false);
    simulate(document, 'mouseup');
    await shouldHappen(() => flow.queryValue('block.@b-label-w') === undefined);
    await baseConn.getValue(`${basePath}.block.@b-label-w`);

    // Normal non-Shift drag on field still starts drag wire.
    const outField = [...blockEl.querySelectorAll<HTMLElement>('.ticl-e-field')][1];
    const outRect = outField.getBoundingClientRect();
    simulate(outField, 'mousedown', fakeMouseEvent(outRect.x + 20, outRect.y + 10));
    simulate(document.body, 'mousemove', fakeMouseEvent(outRect.x + 50, outRect.y + 30));
    expect(document.querySelector('.ticl-e-drag-wire')).not.toBeNull();
    simulate(document.body, 'mouseup');
    expect(document.querySelector('.ticl-e-drag-wire')).toBeNull();

    // Readonly policy blocks Shift+drag divider resize.
    removeLastTemplate();
    const readonlyConn = baseConn.withPolicy({readonly: true});
    const [, roDiv] = loadTemplate(
      <EditPolicyProvider conn={readonlyConn}>
        <BlockStage conn={readonlyConn} basePath={basePath} style={{width: 400, height: 350}} />
      </EditPolicyProvider>,
      'editor'
    );
    const roBlock = await shouldHappen(() => roDiv.querySelector('.ticl-e-block') as HTMLElement);
    const roName = await shouldHappen(() => roBlock.querySelector('.ticl-e-field-name') as HTMLElement);
    const roRect = roName.getBoundingClientRect();
    simulate(roName, 'mousedown', fakeMouseEvent(roRect.right, roRect.y + 8, {button: 0, shiftKey: true}));
    expect(document.body.style.cursor).toBe('');
    simulate(document, 'mousemove', fakeMouseEvent(roRect.right + 30, roRect.y + 8));
    expect(roBlock.classList.contains('ticl-e-block-fixed-label')).toBe(false);
    simulate(document, 'mouseup');
  });
});
