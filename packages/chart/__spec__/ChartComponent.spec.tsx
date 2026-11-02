import React from 'react';
import {Flow, Root} from '@ticlo/core';
import {Chart} from 'chart.js';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen.ts';
import {TicloComp} from '@ticlo/react';
import {creatReactRoot} from '../../react/functions/__spec__/render.ts';
import {registerChartCallback, registerChartPlugin} from '../index.ts';
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
      expect(chartJs.data.datasets[1]).not.toHaveProperty('fill');
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

  it('preserves native legend and scale options while shortcuts only override their fields', async () => {
    const view = creatReactRoot();
    document.body.append(view.div);
    const flow = new Flow();
    const {chart, series} = createChart(flow, 'column', [{id: 'a', label: 'A', value: 10}]);
    chart.setValue('options', {
      plugins: {legend: {display: true, position: 'bottom', align: 'start', labels: {font: {size: 14}}}},
      scales: {y: {beginAtZero: true}},
    });
    let legendClicks = 0;
    registerChartCallback(
      'test:legendClick',
      (_event: unknown, item: {datasetIndex: number}, legend: {chart: Chart}) => {
        legendClicks++;
        legend.chart.setDatasetVisibility(item.datasetIndex, false);
        legend.chart.update();
      }
    );
    chart.setValue('callbackRefs', {'/options/plugins/legend/onClick': 'test:legendClick'});
    series.setValue('dataset', {backgroundColor: 'blue', borderColor: 'green', borderWidth: 3});
    try {
      await view.waitRender(<TicloComp block={chart} />);
      const chartJs = Chart.getChart(view.div.querySelector('canvas'));
      expect(chartJs.options.plugins.legend).toMatchObject({display: true, position: 'bottom', align: 'start'});
      expect(chartJs.options.plugins.legend.labels.font).toMatchObject({size: 14});
      expect(chartJs.options.scales.y).toMatchObject({beginAtZero: true});
      expect(chartJs.data.datasets[0]).toMatchObject({backgroundColor: 'blue', borderColor: 'green', borderWidth: 3});

      chart.setValue('legend', false);
      series.setValue('color', 'red');
      await view.waitRender();
      expect(chartJs.options.plugins.legend).toMatchObject({display: false, position: 'bottom'});
      expect(chartJs.data.datasets[0]).toMatchObject({backgroundColor: 'red', borderColor: 'red', borderWidth: 3});

      chart.deleteValue('legend');
      series.deleteValue('color');
      await view.waitRender();
      expect(chartJs.options.plugins.legend).toMatchObject({display: true, position: 'bottom'});
      expect(chartJs.data.datasets[0]).toMatchObject({backgroundColor: 'blue', borderColor: 'green'});

      chartJs.options.plugins.legend.onClick.call(chartJs.legend, null, {datasetIndex: 0}, chartJs.legend);
      expect(legendClicks).toBe(1);
      series.setValue('data', [{id: 'a', label: 'A', value: 20}]);
      await view.waitRender();
      expect(chartJs.isDatasetVisible(0)).toBe(false);
    } finally {
      view.remove();
      flow.destroy();
    }
  });

  it('uses raw datasets, mixed types, callback references, and registered plugins', async () => {
    const view = creatReactRoot();
    document.body.append(view.div);
    const flow = new Flow();
    registerRenderer(flow);
    const chart = flow.createBlock('chart');
    chart.setValue('#is', 'chart:chart');
    chart.setValue('style', {width: 400, height: 300});
    chart.setValue('data', {
      labels: ['A', 'B'],
      datasets: [{id: 'base', type: 'line', label: 'Raw Line', data: [10, 20], borderColor: 'blue'}],
    });
    chart.setValue('#order', ['series']);
    const series = chart.createBlock('series');
    series.setValue('#is', 'chart:series');
    series.setValue('dataset', {type: 'bar', label: 'Raw Bar', data: [5, 8], backgroundColor: 'green'});
    series.setValue('renderer', ':chart-mark');
    let pluginUpdates = 0;
    registerChartPlugin('test:plugin', {id: 'testChartPlugin', afterUpdate: () => pluginUpdates++});
    registerChartCallback('test:legendFilter', (item: {text: string}) => item.text !== 'Raw Line');
    registerChartCallback('test:pointRadius', () => 4);
    chart.setValue('plugins', ['test:plugin']);
    chart.setValue('callbackRefs', {
      '/options/plugins/legend/labels/filter': 'test:legendFilter',
      '/data/datasets/0/pointRadius': 'test:pointRadius',
    });
    try {
      await view.waitRender(<TicloComp block={chart} />);
      const chartJs = Chart.getChart(view.div.querySelector('canvas'));
      expect(chartJs.data.datasets).toHaveLength(2);
      expect(chartJs.getDatasetMeta(0).type).toBe('line');
      expect(chartJs.getDatasetMeta(1).type).toBe('bar');
      expect(chartJs.data.datasets[0]).toMatchObject({data: [10, 20], borderColor: 'blue'});
      expect(chartJs.data.datasets[1]).toMatchObject({data: [5, 8], backgroundColor: 'green'});
      await vi.waitFor(() => expect(view.div.querySelectorAll('.ticl-chart-mark')).toHaveLength(2));
      expect(chartJs.options.plugins.legend.labels.filter({text: 'Raw Line'}, chartJs.data)).toBe(false);
      expect(chartJs.data.datasets[0]).toMatchObject({pointRadius: expect.any(Function)});
      expect(pluginUpdates).toBeGreaterThan(0);

      series.setValue('targetDatasetIndex', 0);
      await view.waitRender();
      expect(chartJs.data.datasets).toHaveLength(1);
      expect(chartJs.data.datasets[0]).toMatchObject({data: [5, 8], backgroundColor: 'green'});

      chart.setValue('options', {plugins: false});
      await view.waitRender();
      expect(chartJs.options.plugins).toBe(false);
      expect(view.div.querySelectorAll('.ticl-chart-mark')).toHaveLength(0);
    } finally {
      view.remove();
      flow.destroy();
    }
  });

  it('keeps native object data when a renderer cannot map its elements', async () => {
    const view = creatReactRoot();
    document.body.append(view.div);
    const flow = new Flow();
    registerRenderer(flow);
    const {chart, series} = createChart(flow, 'column', []);
    series.deleteValue('data');
    series.setValue('dataset', {data: {A: 5, B: 8}});
    series.setValue('renderer', ':chart-mark');
    try {
      await view.waitRender(<TicloComp block={chart} />);
      const chartJs = Chart.getChart(view.div.querySelector('canvas'));
      expect(chartJs.data.datasets[0].data).toEqual({A: 5, B: 8});
      expect(chartJs.getDatasetMeta(0).data).toHaveLength(2);
      expect(view.div.querySelectorAll('.ticl-chart-mark')).toHaveLength(0);
    } finally {
      view.remove();
      flow.destroy();
    }
  });
});
