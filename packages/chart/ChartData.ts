import type {Block} from '@ticlo/core';

export type TicloChartType = 'column' | 'bar' | 'line' | 'bubble' | 'pie' | 'doughnut';

export interface ChartOptions {
  type: TicloChartType;
  stacked: boolean;
  legend: boolean;
  tooltip: boolean;
  animationDuration: number;
  labels?: string[];
}

export interface ChartSeries {
  block: Block;
  key: string;
  label: string;
  data: unknown[];
  renderer?: string;
  interactive: boolean;
  keyField: string;
  labelField: string;
  valueField: string;
  xField: string;
  yField: string;
  radiusField: string;
  color?: string;
  stack?: string;
  fill: string | false;
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
  series: ChartSeries;
  items: (ChartItem | null)[];
  data: Record<string, unknown>[] | number[];
  config: Record<string, unknown>;
}

const chartTypes = new Set<TicloChartType>(['column', 'bar', 'line', 'bubble', 'pie', 'doughnut']);

function textValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value ? value : fallback;
}

function numberValue(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

export function readChartOptions(block: Block): ChartOptions {
  const rawType = block.getValue('type') as TicloChartType;
  const duration = numberValue(block.getValue('animationDuration'));
  const labels = block.getValue('labels');
  return {
    type: chartTypes.has(rawType) ? rawType : 'column',
    stacked: block.getValue('stacked') === true,
    legend: block.getValue('legend') !== false,
    tooltip: block.getValue('tooltip') !== false,
    animationDuration: duration == null ? 300 : Math.max(0, duration),
    labels: Array.isArray(labels) ? labels.map(String) : undefined,
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
    const fill = series.getValue('fill');
    return [
      {
        block: series,
        key,
        label: textValue(series.getValue('label'), key),
        data: Array.isArray(data) ? data : [],
        renderer: typeof series.getValue('renderer') === 'string' ? (series.getValue('renderer') as string) : undefined,
        interactive: series.getValue('interactive') !== false,
        keyField: textValue(series.getValue('keyField'), 'id'),
        labelField: textValue(series.getValue('labelField'), 'label'),
        valueField: textValue(series.getValue('valueField'), 'value'),
        xField: textValue(series.getValue('xField'), 'x'),
        yField: textValue(series.getValue('yField'), 'y'),
        radiusField: textValue(series.getValue('radiusField'), 'r'),
        color: typeof series.getValue('color') === 'string' ? (series.getValue('color') as string) : undefined,
        stack: typeof series.getValue('stack') === 'string' ? (series.getValue('stack') as string) : undefined,
        fill: typeof fill === 'string' && fill ? fill : false,
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

function rowKey(row: Record<string, unknown>, series: ChartSeries, label: string): string {
  const key = row[series.keyField];
  return key == null ? label : String(key);
}

export function buildChartData(options: ChartOptions, seriesList: ChartSeries[]) {
  const radial = options.type === 'pie' || options.type === 'doughnut';
  const categorical = options.type === 'column' || options.type === 'bar' || options.type === 'line';
  const series = radial ? seriesList.slice(0, 1) : seriesList;
  const labels = options.labels ? [...options.labels] : [];
  if (categorical && !options.labels) {
    const seen = new Set<string>();
    for (const item of series) {
      item.data.forEach((raw, index) => {
        const label = rowLabel(asRow(raw), item, index);
        if (!seen.has(label)) {
          labels.push(label);
          seen.add(label);
        }
      });
    }
  }
  if (radial && !options.labels && series[0]) {
    series[0].data.forEach((raw, index) => labels.push(rowLabel(asRow(raw), series[0], index)));
  }
  const indexBySeries = new Map(series.map((item, index) => [item.key, index]));
  const datasets: ChartDataset[] = series.map((item) => {
    const rows = item.data.map(asRow);
    const createItem = (row: Record<string, unknown>, index: number, label: string): ChartItem => ({
      key: rowKey(row, item, label),
      data: row,
      label,
      value: numberValue(row[item.valueField]),
      xValue: numberValue(row[item.xField]),
      yValue: numberValue(row[item.yField]),
      sizeValue: numberValue(row[item.radiusField]),
      dataIndex: index,
    });
    let items: (ChartItem | null)[];
    let data: Record<string, unknown>[] | number[];
    if (categorical) {
      const byLabel = new Map<string, {row: Record<string, unknown>; index: number}>();
      rows.forEach((row, index) => {
        const label = rowLabel(row, item, index);
        if (!byLabel.has(label)) byLabel.set(label, {row, index});
      });
      items = labels.map((label) => {
        const match = byLabel.get(label);
        return match ? createItem(match.row, match.index, label) : null;
      });
      data = items.map((entry) => {
        const category = entry?.label;
        const value = entry?.value ?? null;
        return options.type === 'bar' ? {y: category, x: value} : {x: category, y: value};
      });
    } else {
      items = rows.map((row, index) => createItem(row, index, rowLabel(row, item, index)));
      data = radial
        ? items.map((entry) => entry?.value ?? 0)
        : items.map((entry) => ({x: entry?.xValue ?? null, y: entry?.yValue ?? null, r: entry?.sizeValue ?? 0}));
    }
    const config: Record<string, unknown> = {label: item.label, data};
    if (item.color) {
      config.backgroundColor = item.color;
      config.borderColor = item.color;
    }
    if (item.stack) config.stack = item.stack;
    if (options.type === 'line') {
      config.fill =
        typeof item.fill === 'string' && indexBySeries.has(item.fill) ? indexBySeries.get(item.fill) : item.fill;
      if (item.renderer) {
        config.pointStyle = false;
        config.pointRadius = item.markerSize / 2;
        config.pointHitRadius = item.markerSize / 2;
      }
    }
    if (options.type === 'bubble' && item.renderer) config.pointStyle = false;
    return {series: item, items, data, config};
  });
  return {labels, datasets};
}
