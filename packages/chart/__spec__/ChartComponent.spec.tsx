import React from 'react';
import {Flow, Root} from '@ticlo/core';
import {Chart} from 'chart.js';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen.ts';
import {TicloComp} from '@ticlo/react';
import {creatReactRoot} from '../../react/functions/__spec__/render.ts';
import '../index.ts';
import '../style/index.css';

function createChart(flow: Flow, type: string, data: unknown[]) {
  const chart = flow.createBlock('chart');
  chart.setValue('#is', 'chart:chart');
  chart.setValue('type', type);
  chart.setValue('style', {width: 400, height: 300});
  chart.setValue('#order', ['series']);
  const series = chart.createBlock('series');
  series.setValue('#is', 'chart:series');
  series.setValue('data', data);
  return {chart, series};
}

function registerRenderer(flow: Flow) {
  WorkerFunctionGen.registerType(
    {
      '#is': '',
      '#inputs': {
        '#is': '',
        '#custom': [
          {name: 'label', type: 'string'},
          {name: 'width', type: 'number'},
        ],
      },
      '#main': {'#is': 'react:div', '~content': '##.#inputs.label'},
      '#outputs': {'#is': '', '~#return': '##.#main'},
    },
    {id: ':chart-mark', name: 'chart-mark'},
    undefined,
    flow.getFuncLib()
  );
}

describe('chart renderer', () => {
  it('renders native bars and reuses interactive custom marks by row id', async () => {
    const view = creatReactRoot();
    document.body.append(view.div);
    const flow = new Flow();
    registerRenderer(flow);
    const {chart, series} = createChart(flow, 'column', [
      {id: 'jan', label: 'Jan', value: 10},
      {id: 'feb', label: 'Feb', value: 20},
    ]);
    try {
      await view.waitRender(<TicloComp block={chart} />);
      expect(view.div.querySelector('canvas')).toBeInstanceOf(HTMLCanvasElement);
      expect(view.div.querySelectorAll('.ticl-chart-mark')).toHaveLength(0);

      series.setValue('renderer', ':chart-mark');
      Root.run();
      await view.waitRender();
      await vi.waitFor(() => expect(view.div.querySelectorAll('.ticl-chart-mark')).toHaveLength(2));
      const jan = [...view.div.querySelectorAll<HTMLElement>('.ticl-chart-mark')].find(
        (element) => element.textContent === 'Jan'
      );
      expect(jan).toBeTruthy();
      expect(jan.dataset.interactive).toBe('true');
      expect(Number.parseFloat(jan.style.width)).toBeGreaterThan(0);
      expect(Number.parseFloat(jan.style.height)).toBeGreaterThan(0);
      jan.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: jan.getBoundingClientRect().left + 2,
          clientY: jan.getBoundingClientRect().top + 2,
        })
      );
      await view.waitRender();
      await vi.waitFor(() =>
        expect((view.div.querySelector('.ticl-chart-tooltip') as HTMLElement).style.display).toBe('block')
      );

      series.setValue('data', [
        {id: 'feb', label: 'Feb', value: 30},
        {id: 'jan', label: 'Jan', value: 15},
      ]);
      Root.run();
      await view.waitRender();
      await vi.waitFor(() => expect(view.div.querySelectorAll('.ticl-chart-mark')).toHaveLength(2));
      expect([...view.div.querySelectorAll('.ticl-chart-mark')].find((element) => element.textContent === 'Jan')).toBe(
        jan
      );

      series.setValue('interactive', false);
      await view.waitRender();
      expect(view.div.querySelector('.ticl-chart-mark')?.getAttribute('data-interactive')).toBeNull();

      const chartJs = Chart.getChart(view.div.querySelector('canvas'));
      chartJs.options.plugins.legend.onClick.call(chartJs.legend, null, {datasetIndex: 0}, chartJs.legend);
      await view.waitRender();
      expect(view.div.querySelectorAll('.ticl-chart-mark')).toHaveLength(0);
      series.setValue('data', [{id: 'jan', label: 'Jan', value: 5}]);
      await view.waitRender();
      expect(view.div.querySelectorAll('.ticl-chart-mark')).toHaveLength(0);
    } finally {
      view.remove();
      flow.destroy();
    }
  });

  it('keeps the line and area on Canvas while replacing only their points', async () => {
    const view = creatReactRoot();
    document.body.append(view.div);
    const flow = new Flow();
    registerRenderer(flow);
    const {chart, series} = createChart(flow, 'line', [
      {id: 'a', label: 'A', value: 10},
      {id: 'b', label: 'B', value: 20},
    ]);
    series.setValue('fill', 'origin');
    series.setValue('renderer', ':chart-mark');
    chart.setValue('#order', ['series', 'line']);
    const line = chart.createBlock('line');
    line.setValue('#is', 'chart:series');
    line.setValue('data', [
      {id: 'a', label: 'A', value: 5},
      {id: 'b', label: 'B', value: 15},
    ]);
    try {
      await view.waitRender(<TicloComp block={chart} />);
      Root.run();
      await view.waitRender();
      await vi.waitFor(() => expect(view.div.querySelectorAll('.ticl-chart-mark')).toHaveLength(2));
      const marks = view.div.querySelectorAll<HTMLElement>('.ticl-chart-mark');
      expect(marks[0].style.width).toBe('12px');
      expect(marks[0].style.height).toBe('12px');
      const chartJs = Chart.getChart(view.div.querySelector('canvas'));
      expect(chartJs.data.datasets).toHaveLength(2);
      expect(chartJs.data.datasets[0]).toMatchObject({fill: 'origin'});
      expect(chartJs.data.datasets[1]).toMatchObject({fill: false});
    } finally {
      view.remove();
      flow.destroy();
    }
  });

  it('uses native pie slices and custom bubble geometry', async () => {
    const view = creatReactRoot();
    document.body.append(view.div);
    const flow = new Flow();
    registerRenderer(flow);
    const {chart, series} = createChart(flow, 'bubble', [{id: 'a', label: 'A', x: 2, y: 3, r: 10}]);
    series.setValue('renderer', ':chart-mark');
    try {
      await view.waitRender(<TicloComp block={chart} />);
      Root.run();
      await view.waitRender();
      await vi.waitFor(() => expect(view.div.querySelectorAll('.ticl-chart-mark')).toHaveLength(1));
      expect((view.div.querySelector('.ticl-chart-mark') as HTMLElement).style.width).toBe('20px');

      chart.setValue('type', 'pie');
      series.setValue('data', [{id: 'a', label: 'A', value: 3}]);
      Root.run();
      await view.waitRender();
      await vi.waitFor(() => expect(view.div.querySelectorAll('.ticl-chart-mark')).toHaveLength(0));
      const chartJs = Chart.getChart(view.div.querySelector('canvas'));
      expect(chartJs.getDatasetMeta(0).type).toBe('pie');
    } finally {
      view.remove();
      flow.destroy();
    }
  });
});
