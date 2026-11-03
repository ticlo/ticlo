import type {Block} from '@ticlo/core';
import {applyCallbackRefs, asObject, cloneConfig, mergeConfig} from './ChartConfig.ts';

export interface ChartOptions {
  type: string;
  data: Record<string, unknown>;
  options: Record<string, unknown>;
  plugins: unknown;
  callbackRefs: unknown;
  labels?: unknown[];
  stacked?: boolean;
  legend?: boolean;
  tooltip?: boolean;
  animationDuration?: number;
  tooltipMode: 'auto' | 'html' | 'native';
}

export interface ChartSeries {
  block: Block;
  key: string;
  dataset: Record<string, unknown>;
  targetDatasetIndex?: number;
  type?: string;
  label?: string;
  data?: unknown[];
  renderer?: string;
  rendererMode: 'replace' | 'overlay';
  interactive: boolean;
  callbackRefs: unknown;
  keyField: string;
  labelField: string;
  valueField: string;
  xField: string;
  yField: string;
  radiusField: string;
  color?: string;
  stack?: string;
  fill?: unknown;
  markerSize: number;
}

export interface ChartItem {
  key: string;
  data: Record<string, unknown>;
  label: string;
  value?: number;
  xValue?: number;
  yValue?: number;
  sizeValue?: number;
  dataIndex: number;
}

export interface ChartDataset {
  key: string;
  type: string;
  series?: ChartSeries;
  items: (ChartItem | null)[];
  config: Record<string, unknown>;
}

function textValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value ? value : fallback;
}

function numberValue(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

export function chartJsType(type: string): string {
  return type === 'column' ? 'bar' : type;
}

export function overlayAvailable(options: ChartOptions, type: string, data?: unknown): boolean {
  if (
    !['bar', 'line', 'bubble'].includes(type) ||
    options.options.plugins === false ||
    (data != null && !Array.isArray(data))
  )
    return false;
  const decimation = asObject(asObject(options.options.plugins).decimation);
  return !(type === 'line' && decimation.enabled === true);
}

export function readChartOptions(block: Block): ChartOptions {
  const type = block.getValue('type');
  const labels = block.getValue('labels');
  const mode = block.getValue('tooltipMode');
  const duration = numberValue(block.getValue('animationDuration'));
  const stacked = block.getValue('stacked');
  const legend = block.getValue('legend');
  const tooltip = block.getValue('tooltip');
  return {
    type: typeof type === 'string' && type ? type : 'column',
    data: asObject(block.getValue('data')),
    options: asObject(block.getValue('options')),
    plugins: block.getValue('plugins'),
    callbackRefs: block.getValue('callbackRefs'),
    labels: Array.isArray(labels) ? labels : undefined,
    stacked: typeof stacked === 'boolean' ? stacked : undefined,
    legend: typeof legend === 'boolean' ? legend : undefined,
    tooltip: typeof tooltip === 'boolean' ? tooltip : undefined,
    animationDuration: duration == null ? undefined : Math.max(0, duration),
    tooltipMode: mode === 'html' || mode === 'native' ? mode : 'auto',
  };
}

export function readChartSeries(block: Block): ChartSeries[] {
  const order = block.getValue('#order');
  if (!Array.isArray(order)) return [];
  return order.flatMap((key) => {
    if (typeof key !== 'string') return [];
    const child = block.getValue(key);
    if (!child || typeof child !== 'object' || (child as Block).getValue?.('#is') !== 'chart:series') return [];
    const series = child as Block;
    const data = series.getValue('data');
    const type = series.getValue('type');
    const label = series.getValue('label');
    const target = numberValue(series.getValue('targetDatasetIndex'));
    const rendererMode = series.getValue('rendererMode');
    return [
      {
        block: series,
        key,
        dataset: asObject(series.getValue('dataset')),
        targetDatasetIndex: target != null && Number.isInteger(target) && target >= 0 ? target : undefined,
        type: typeof type === 'string' && type ? type : undefined,
        label: typeof label === 'string' ? label : undefined,
        data: Array.isArray(data) ? data : undefined,
        renderer: typeof series.getValue('renderer') === 'string' ? (series.getValue('renderer') as string) : undefined,
        rendererMode: rendererMode === 'overlay' ? 'overlay' : 'replace',
        interactive: series.getValue('interactive') !== false,
        callbackRefs: series.getValue('callbackRefs'),
        keyField: textValue(series.getValue('keyField'), 'id'),
        labelField: textValue(series.getValue('labelField'), 'label'),
        valueField: textValue(series.getValue('valueField'), 'value'),
        xField: textValue(series.getValue('xField'), 'x'),
        yField: textValue(series.getValue('yField'), 'y'),
        radiusField: textValue(series.getValue('radiusField'), 'r'),
        color: typeof series.getValue('color') === 'string' ? (series.getValue('color') as string) : undefined,
        stack: typeof series.getValue('stack') === 'string' ? (series.getValue('stack') as string) : undefined,
        fill: series.getValue('fill'),
        markerSize: Math.max(0, numberValue(series.getValue('markerSize')) ?? 12),
      },
    ];
  });
}

function asRow(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {value};
}

function rowLabel(row: Record<string, unknown>, series: ChartSeries, index: number): string {
  const label = row[series.labelField];
  return label == null ? String(index) : String(label);
}

function makeItem(row: Record<string, unknown>, series: ChartSeries, index: number, label: string): ChartItem {
  const key = row[series.keyField];
  return {
    key: key == null ? label : String(key),
    data: row,
    label,
    value: numberValue(row[series.valueField]),
    xValue: numberValue(row[series.xField]),
    yValue: numberValue(row[series.yField]),
    sizeValue: numberValue(row[series.radiusField]),
    dataIndex: index,
  };
}

function mappedData(series: ChartSeries, type: string, labels: unknown[], horizontal: boolean) {
  const rows = series.data.map(asRow);
  const categorical = type === 'bar' || type === 'column' || type === 'line';
  const radial = type === 'pie' || type === 'doughnut' || type === 'polarArea';
  let items: (ChartItem | null)[];
  if (categorical || radial) {
    const byLabel = new Map<string, {row: Record<string, unknown>; index: number}>();
    rows.forEach((row, index) => {
      const label = rowLabel(row, series, index);
      if (!byLabel.has(label)) byLabel.set(label, {row, index});
    });
    items = labels.map((label) => {
      const match = byLabel.get(String(label));
      return match ? makeItem(match.row, series, match.index, String(label)) : null;
    });
  } else {
    items = rows.map((row, index) => makeItem(row, series, index, rowLabel(row, series, index)));
  }
  const data = radial
    ? items.map((item) => item?.value ?? 0)
    : categorical
      ? items.map((item) => {
          const label = item?.label;
          const value = item?.value ?? null;
          return horizontal ? {y: label, x: value} : {x: label, y: value};
        })
      : items.map((item) => ({x: item?.xValue ?? null, y: item?.yValue ?? null, r: item?.sizeValue ?? 0}));
  return {items, data};
}

function rawItems(data: unknown, series: ChartSeries, labels: unknown[]): ChartItem[] {
  if (!Array.isArray(data)) return [];
  return data.map((raw, index) => {
    const row = asRow(raw);
    return makeItem(row, series, index, labels[index] == null ? rowLabel(row, series, index) : String(labels[index]));
  });
}

export function buildChartData(options: ChartOptions, seriesList: ChartSeries[]) {
  const rawData = cloneConfig(options.data);
  const hasRawLabels = Array.isArray(rawData.labels);
  const labels = options.labels
    ? cloneConfig(options.labels)
    : hasRawLabels
      ? cloneConfig(rawData.labels as unknown[])
      : [];
  if (!options.labels && !hasRawLabels) {
    const seen = new Set<string>();
    for (const series of seriesList) {
      if (!series.data) continue;
      const type = series.type ?? (typeof series.dataset.type === 'string' ? series.dataset.type : options.type);
      if (!['column', 'bar', 'line', 'pie', 'doughnut', 'polarArea'].includes(type)) continue;
      series.data.forEach((raw, index) => {
        const label = rowLabel(asRow(raw), series, index);
        if (!seen.has(label)) {
          seen.add(label);
          labels.push(label);
        }
      });
    }
  }
  const rawDatasets = Array.isArray(rawData.datasets) ? rawData.datasets : [];
  const datasets: ChartDataset[] = rawDatasets.map((value, index) => {
    const config = asObject(value);
    return {
      key: `raw:${textValue(config.id, String(index))}`,
      type: typeof config.type === 'string' ? config.type : chartJsType(options.type),
      items: [] as ChartItem[],
      config,
    };
  });
  const targets = new Set<number>();
  for (const series of seriesList) {
    const target = series.targetDatasetIndex;
    if (target != null && (target >= rawDatasets.length || targets.has(target))) {
      throw new Error(`Invalid or repeated chart dataset target: ${target}`);
    }
    if (target != null) targets.add(target);
    const config = mergeConfig(target == null ? {} : datasets[target].config, series.dataset);
    if (series.type != null) config.type = chartJsType(series.type);
    if (series.type === 'bar' && config.indexAxis === undefined) config.indexAxis = 'y';
    if (series.type === 'column' && config.indexAxis === undefined) config.indexAxis = 'x';
    if (series.label != null) config.label = series.label;
    if (series.color != null) {
      config.backgroundColor = series.color;
      config.borderColor = series.color;
    }
    if (series.stack != null) config.stack = series.stack;
    if (series.fill !== undefined) config.fill = series.fill;
    const type = series.type ?? (typeof config.type === 'string' ? config.type : options.type);
    let items: (ChartItem | null)[];
    if (series.data) {
      const horizontal =
        (config.indexAxis ?? options.options.indexAxis ?? (options.type === 'bar' ? 'y' : 'x')) === 'y';
      const mapped = mappedData(series, type, labels, horizontal);
      config.data = mapped.data;
      items = mapped.items;
    } else {
      items = rawItems(config.data, series, labels);
    }
    if (
      series.renderer &&
      series.rendererMode === 'replace' &&
      overlayAvailable(options, chartJsType(type), config.data)
    ) {
      if (type === 'line') {
        config.pointStyle = false;
        config.pointRadius = series.markerSize / 2;
        config.pointHitRadius = series.markerSize / 2;
      } else if (type === 'bubble') config.pointStyle = false;
    }
    applyCallbackRefs(config, series.callbackRefs);
    const entry: ChartDataset = {key: `series:${series.key}`, type: chartJsType(type), series, items, config};
    if (target == null) datasets.push(entry);
    else datasets[target] = entry;
  }
  const indexBySeries = new Map(datasets.map((entry, index) => [entry.series?.key ?? entry.config.id, index]));
  for (const entry of datasets) {
    const fill = entry.series?.fill;
    if (
      typeof fill === 'string' &&
      !['origin', 'start', 'end', 'stack', 'shape'].includes(fill) &&
      indexBySeries.has(fill)
    )
      entry.config.fill = indexBySeries.get(fill);
  }
  if (options.labels || hasRawLabels || labels.length) rawData.labels = labels;
  rawData.datasets = datasets.map((entry) => entry.config);
  return {data: rawData, datasets};
}
