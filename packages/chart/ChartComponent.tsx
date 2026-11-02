import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Block} from '@ticlo/core';
import {
  Chart,
  type ChartConfiguration,
  type ChartType,
  type Plugin,
  ArcElement,
  BarController,
  BarElement,
  BubbleController,
  CategoryScale,
  Colors,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PieController,
  PointElement,
  Tooltip,
} from 'chart.js';
import {TicloComp, useBlockValue, useTicloComp} from '@ticlo/react';
import {
  buildChartData,
  readChartOptions,
  readChartSeries,
  type ChartDataset,
  type ChartItem,
  type ChartOptions,
  type ChartSeries,
} from './ChartData.ts';

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  BubbleController,
  CategoryScale,
  Colors,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PieController,
  PointElement,
  Tooltip
);

interface Mark extends ChartItem {
  seriesKey: string;
  seriesLabel: string;
  datasetIndex: number;
  chartIndex: number;
  left: number;
  top: number;
  width: number;
  height: number;
  radius?: number;
  startValue?: number;
  endValue?: number;
  orientation?: 'horizontal' | 'vertical';
}

interface Geometry {
  marks: Mark[];
  area: {top: number; right: number; bottom: number; left: number};
  animate: boolean;
}

function sameGeometry(a: Geometry, b: Geometry) {
  if (
    a.animate !== b.animate ||
    a.area.top !== b.area.top ||
    a.area.right !== b.area.right ||
    a.area.bottom !== b.area.bottom ||
    a.area.left !== b.area.left ||
    a.marks.length !== b.marks.length
  )
    return false;
  return a.marks.every((mark, index) => {
    const other = b.marks[index];
    return (
      mark.key === other.key &&
      mark.seriesKey === other.seriesKey &&
      mark.data === other.data &&
      mark.label === other.label &&
      mark.seriesLabel === other.seriesLabel &&
      mark.datasetIndex === other.datasetIndex &&
      mark.chartIndex === other.chartIndex &&
      mark.dataIndex === other.dataIndex &&
      mark.left === other.left &&
      mark.top === other.top &&
      mark.width === other.width &&
      mark.height === other.height &&
      mark.radius === other.radius &&
      mark.value === other.value &&
      mark.xValue === other.xValue &&
      mark.yValue === other.yValue &&
      mark.sizeValue === other.sizeValue &&
      mark.startValue === other.startValue &&
      mark.endValue === other.endValue &&
      mark.orientation === other.orientation
    );
  });
}

function useChartSnapshot(block: Block) {
  const [snapshot, setSnapshot] = useState(() => ({options: readChartOptions(block), series: readChartSeries(block)}));
  useEffect(() => {
    const watched = new Map<Block, {onChildChange: () => void}>();
    const update = () => setSnapshot({options: readChartOptions(block), series: readChartSeries(block)});
    const onSeriesChange = () => update();
    const syncSeries = () => {
      const current = new Set(readChartSeries(block).map((series) => series.block));
      for (const [series, listener] of watched) {
        if (!current.has(series)) {
          series.unwatch(listener);
          watched.delete(series);
        }
      }
      for (const series of current) {
        if (!watched.has(series)) {
          const listener = {onChildChange: onSeriesChange};
          series.watch(listener);
          watched.set(series, listener);
        }
      }
    };
    const chartListener = {
      onChildChange(property: {_name: string}) {
        if (property._name.startsWith('#chartRuntime')) return;
        syncSeries();
        update();
      },
    };
    block.watch(chartListener);
    syncSeries();
    update();
    return () => {
      block.unwatch(chartListener);
      for (const [series, listener] of watched) series.unwatch(listener);
    };
  }, [block]);
  return snapshot;
}

function chartJsType(type: ChartOptions['type']): ChartType {
  return type === 'column' ? 'bar' : type;
}

function makeMarks(chart: Chart, datasets: ChartDataset[], options: ChartOptions, mode: string): Geometry {
  const marks: Mark[] = [];
  const area = chart.chartArea;
  for (let datasetIndex = 0; datasetIndex < datasets.length; datasetIndex++) {
    const {series, items} = datasets[datasetIndex];
    if (
      !series.renderer ||
      options.type === 'pie' ||
      options.type === 'doughnut' ||
      !chart.isDatasetVisible(datasetIndex)
    )
      continue;
    const elements = chart.getDatasetMeta(datasetIndex).data;
    for (let index = 0; index < elements.length; index++) {
      const item = items[index];
      const element = elements[index];
      if (!item || !element || (element as PointElement).skip) continue;
      let left: number, top: number, width: number, height: number, radius: number | undefined;
      let startValue: number | undefined, endValue: number | undefined;
      let orientation: Mark['orientation'];
      if (options.type === 'column' || options.type === 'bar') {
        const bar = element as BarElement;
        const position = bar.getProps(['x', 'y', 'base', 'width', 'height'], true);
        const horizontal = options.type === 'bar';
        orientation = horizontal ? 'horizontal' : 'vertical';
        left = horizontal ? Math.min(position.x, position.base) : position.x - position.width / 2;
        top = horizontal ? position.y - position.height / 2 : Math.min(position.y, position.base);
        width = horizontal ? Math.abs(position.x - position.base) : position.width;
        height = horizontal ? position.height : Math.abs(position.y - position.base);
        const scale = chart.getDatasetMeta(datasetIndex).vScale;
        startValue = scale?.getValueForPixel(position.base) as number | undefined;
        endValue = scale?.getValueForPixel(horizontal ? position.x : position.y) as number | undefined;
      } else {
        const point = element as PointElement;
        const position = point.getProps(['x', 'y'], true);
        radius = options.type === 'line' ? series.markerSize / 2 : (item.sizeValue ?? point.options.radius ?? 0);
        left = position.x - radius;
        top = position.y - radius;
        width = radius * 2;
        height = radius * 2;
      }
      if (![left, top, width, height].every(Number.isFinite)) continue;
      marks.push({
        ...item,
        seriesKey: series.key,
        seriesLabel: series.label,
        datasetIndex,
        chartIndex: index,
        left,
        top,
        width,
        height,
        radius,
        startValue,
        endValue,
        orientation,
      });
    }
  }
  return {
    marks,
    area: {top: area.top, right: chart.width - area.right, bottom: chart.height - area.bottom, left: area.left},
    animate: mode !== 'resize' && mode !== 'hide' && mode !== 'show' && mode !== 'none',
  };
}

function updateTooltip(host: HTMLDivElement | null, tooltip: Chart['tooltip'], enabled: boolean) {
  if (!host) return;
  if (!enabled || !tooltip || !tooltip.opacity) {
    host.style.display = 'none';
    return;
  }
  const lines = [...tooltip.title, ...tooltip.body.flatMap((body) => body.lines), ...tooltip.footer];
  host.textContent = lines.join('\n');
  host.style.left = `${tooltip.caretX}px`;
  host.style.top = `${tooltip.caretY}px`;
  host.style.display = 'block';
}

function RendererResults({
  worker,
  marks,
  fields,
  duration,
  animate,
  interactive,
}: {
  worker: Block;
  marks: Mark[];
  fields: Map<string, string>;
  duration: number;
  animate: boolean;
  interactive: boolean;
}) {
  const output = useBlockValue<Record<string, unknown>>(worker, '#output');
  return marks.map((mark) => {
    const field = fields.get(mark.key);
    const value = field && output?.[field];
    if (!field || !value || typeof value !== 'object' || !(value as Block).getValue) return null;
    return (
      <div
        key={field}
        className="ticl-chart-mark"
        data-interactive={interactive || undefined}
        data-dataset={mark.datasetIndex}
        data-index={mark.chartIndex}
        style={{
          left: mark.left,
          top: mark.top,
          width: mark.width,
          height: mark.height,
          pointerEvents: interactive ? 'auto' : 'none',
          transition:
            animate && duration
              ? `left ${duration}ms linear, top ${duration}ms linear, width ${duration}ms linear, height ${duration}ms linear`
              : 'none',
        }}
      >
        <div className="ticl-chart-renderer">
          <TicloComp block={value as Block} />
        </div>
      </div>
    );
  });
}

function SeriesOverlay({
  chartBlock,
  chartType,
  series,
  marks,
  duration,
  animate,
  activeKeys,
}: {
  chartBlock: Block;
  chartType: ChartOptions['type'];
  series: ChartSeries;
  marks: Mark[];
  duration: number;
  animate: boolean;
  activeKeys: Set<string>;
}) {
  const [runtimeField] = useState(() => `#chartRuntime${Block.nextUid()}`);
  const [runtime, setRuntime] = useState<{worker: Block; input: Block} | null>(null);
  const fields = useRef(new Map<string, string>());
  const nextField = useRef(0);
  useEffect(() => {
    const currentFields = fields.current;
    const host = chartBlock.createOutputBlock(runtimeField);
    const worker = host.createOutputBlock('worker');
    const input = host.createOutputBlock('input');
    worker.updateValue('#is', 'multi-worker');
    worker.updateValue('use', series.renderer);
    worker.updateValue('input', input);
    setRuntime({worker, input});
    return () => {
      chartBlock.deleteValue(runtimeField);
      currentFields.clear();
    };
  }, [chartBlock, runtimeField, series.renderer]);
  useEffect(() => {
    if (!runtime) return;
    const next = new Set<string>();
    for (const mark of marks) {
      const key = mark.key;
      next.add(key);
      let field = fields.current.get(key);
      if (!field) {
        field = `m${nextField.current++}`;
        fields.current.set(key, field);
      }
      const active = activeKeys.has(`${mark.datasetIndex}:${mark.chartIndex}`);
      const payload = {
        data: mark.data,
        key,
        label: mark.label,
        chartType,
        seriesKey: series.key,
        seriesLabel: mark.seriesLabel,
        seriesVisible: true,
        interactive: series.interactive,
        color: series.color,
        stack: series.stack,
        datasetIndex: mark.datasetIndex,
        chartIndex: mark.chartIndex,
        dataIndex: mark.dataIndex,
        left: mark.left,
        top: mark.top,
        width: mark.width,
        height: mark.height,
        active,
        value: mark.value,
        xValue: mark.xValue,
        yValue: mark.yValue,
        sizeValue: mark.sizeValue,
        radius: mark.radius,
        startValue: mark.startValue,
        endValue: mark.endValue,
        orientation: mark.orientation,
      };
      const previous = runtime.input.getValue(field) as typeof payload;
      if (
        !previous ||
        Object.keys(payload).some(
          (name) => !Object.is(previous[name as keyof typeof payload], payload[name as keyof typeof payload])
        )
      ) {
        runtime.input.updateValue(field, payload);
      }
    }
    for (const [key, field] of fields.current) {
      if (!next.has(key)) {
        runtime.input.deleteValue(field);
        fields.current.delete(key);
      }
    }
  }, [runtime, marks, series, chartType, activeKeys]);
  return (
    runtime && (
      <RendererResults
        worker={runtime.worker}
        marks={marks}
        fields={fields.current}
        duration={duration}
        animate={animate}
        interactive={series.interactive}
      />
    )
  );
}

export function ChartComponent({block}: {block: Block}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const {style, className, optionalHandlers} = useTicloComp(block, {noChildren: true, ref: rootRef});
  const snapshot = useChartSnapshot(block);
  const data = useMemo(() => buildChartData(snapshot.options, snapshot.series), [snapshot]);
  const latest = useRef({data, options: snapshot.options});
  latest.current = {data, options: snapshot.options};
  const [geometry, setGeometry] = useState<Geometry>({
    marks: [],
    area: {top: 0, right: 0, bottom: 0, left: 0},
    animate: false,
  });
  const [activeKeys, setActiveKeys] = useState(new Set<string>());
  const activeRef = useRef('');
  const seriesVisibility = useRef(new Map<string, boolean>());
  const itemVisibility = useRef(new Map<string, boolean>());
  const updateActive = useCallback((elements: {datasetIndex: number; index: number}[]) => {
    const ids = elements.map(({datasetIndex, index}) => `${datasetIndex}:${index}`);
    const signature = ids.join('|');
    if (signature !== activeRef.current) {
      activeRef.current = signature;
      setActiveKeys(new Set(ids));
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const plugin: Plugin = {
      id: 'ticloChartOverlay',
      beforeDatasetDraw(_chart, args) {
        const {data, options} = latest.current;
        if ((options.type === 'column' || options.type === 'bar') && data.datasets[args.index]?.series.renderer)
          return false;
      },
      afterUpdate(chart, args) {
        const {data, options} = latest.current;
        const next = makeMarks(chart, data.datasets, options, args.mode);
        setGeometry((previous) => (sameGeometry(previous, next) ? previous : next));
      },
      afterEvent(chart) {
        updateActive(chart.getActiveElements());
      },
    };
    const {options, data} = latest.current;
    const chart = new Chart(canvasRef.current, {
      type: chartJsType(options.type),
      data: {labels: data.labels, datasets: data.datasets.map((entry) => entry.config)},
      plugins: [plugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: options.type === 'bar' ? 'y' : 'x',
        animation: false,
        scales:
          options.type === 'pie' || options.type === 'doughnut'
            ? undefined
            : {
                x: {stacked: options.stacked},
                y: {stacked: options.stacked},
              },
        plugins: {
          legend: {
            display: options.legend,
            onClick: (_event: unknown, item: {datasetIndex?: number; index?: number}, legend: {chart: Chart}) => {
              const target = legend.chart;
              const current = latest.current;
              if (current.options.type === 'pie' || current.options.type === 'doughnut') {
                const index = item.index;
                const dataItem = index == null ? null : current.data.datasets[0]?.items[index];
                if (!dataItem) return;
                target.toggleDataVisibility(index);
                itemVisibility.current.set(dataItem.key, target.getDataVisibility(index));
              } else {
                const index = item.datasetIndex;
                const dataset = index == null ? null : current.data.datasets[index];
                if (!dataset) return;
                const visible = !target.isDatasetVisible(index);
                target.setDatasetVisibility(index, visible);
                seriesVisibility.current.set(dataset.series.key, visible);
              }
              target.update();
            },
          },
          tooltip: {
            enabled: false,
            external: ({tooltip}: {tooltip: Chart['tooltip']}) =>
              updateTooltip(tooltipRef.current, tooltip, latest.current.options.tooltip),
          },
          decimation: {enabled: false},
        },
      },
    } as unknown as ChartConfiguration);
    chartRef.current = chart;
    chart.options.animation = {duration: options.animationDuration, easing: 'linear'};
    return () => {
      chartRef.current = null;
      chart.destroy();
      activeRef.current = '';
    };
  }, [block, snapshot.options.type, updateActive]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const {options} = snapshot;
    chart.data.labels = data.labels;
    chart.data.datasets = data.datasets.map((entry) => entry.config) as unknown as Chart['data']['datasets'];
    data.datasets.forEach((entry, index) => {
      chart.setDatasetVisibility(index, seriesVisibility.current.get(entry.series.key) ?? true);
    });
    if (options.type === 'pie' || options.type === 'doughnut') {
      data.datasets[0]?.items.forEach((item, index) => {
        const visible = item && itemVisibility.current.get(item.key);
        if (visible !== undefined && chart.getDataVisibility(index) !== visible) chart.toggleDataVisibility(index);
      });
    }
    chart.options.indexAxis = options.type === 'bar' ? 'y' : 'x';
    chart.options.scales =
      options.type === 'pie' || options.type === 'doughnut'
        ? undefined
        : {
            x: {stacked: options.stacked},
            y: {stacked: options.stacked},
          };
    chart.options.plugins.legend.display = options.legend;
    chart.options.animation = {duration: options.animationDuration, easing: 'linear'};
    chart.update();
  }, [data, snapshot]);

  const onPointerMoveCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    const target =
      event.target instanceof Element ? event.target.closest<HTMLElement>('.ticl-chart-mark[data-interactive]') : null;
    const chart = chartRef.current;
    if (!target || !chart) return;
    const elements = [{datasetIndex: Number(target.dataset.dataset), index: Number(target.dataset.index)}];
    const signature = `${elements[0].datasetIndex}:${elements[0].index}`;
    if (signature === activeRef.current) return;
    const rect = chart.canvas.getBoundingClientRect();
    const position = {
      x: ((event.clientX - rect.left) * chart.width) / rect.width,
      y: ((event.clientY - rect.top) * chart.height) / rect.height,
    };
    chart.setActiveElements(elements);
    chart.tooltip?.setActiveElements(elements, position);
    updateActive(elements);
    chart.update('none');
  };
  const onPointerLeave = () => {
    const chart = chartRef.current;
    if (!chart || !activeRef.current) return;
    chart.setActiveElements([]);
    chart.tooltip?.setActiveElements([], {x: 0, y: 0});
    updateActive([]);
    chart.update('none');
  };
  return (
    <div
      ref={rootRef}
      className={className ? `ticl-chart ${className}` : 'ticl-chart'}
      style={style}
      {...optionalHandlers}
      onPointerMoveCapture={onPointerMoveCapture}
      onPointerLeave={onPointerLeave}
    >
      <div className="ticl-chart-canvas">
        <canvas ref={canvasRef} />
      </div>
      <div
        className="ticl-chart-overlay"
        style={{
          clipPath: `inset(${geometry.area.top}px ${geometry.area.right}px ${geometry.area.bottom}px ${geometry.area.left}px)`,
        }}
      >
        {data.datasets
          .filter(
            ({series}) => series.renderer && snapshot.options.type !== 'pie' && snapshot.options.type !== 'doughnut'
          )
          .map(({series}) => (
            <SeriesOverlay
              key={series.key}
              chartBlock={block}
              chartType={snapshot.options.type}
              series={series}
              marks={geometry.marks.filter((mark) => mark.seriesKey === series.key)}
              duration={snapshot.options.animationDuration}
              animate={geometry.animate}
              activeKeys={activeKeys}
            />
          ))}
      </div>
      <div ref={tooltipRef} className="ticl-chart-tooltip" />
    </div>
  );
}
