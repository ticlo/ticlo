import {globalFunctions} from '@ticlo/core';
import {metaKey} from '@ticlo/react';
import {ChartComponent} from './ChartComponent.tsx';

export {ChartComponent} from './ChartComponent.tsx';
export {buildChartData, readChartOptions, readChartSeries} from './ChartData.ts';
export {registerChartCallback, registerChartPlugin} from './ChartConfig.ts';

globalFunctions.addCategory({id: 'chart:', name: 'Chart', icon: 'svg:line-chart', color: 'ff6384', ns: 'chart'});

globalFunctions.addFactory(
  null,
  {
    name: 'chart',
    icon: 'svg:area-chart',
    tags: ['react-comp'],
    childrenTags: ['chart-series'],
    configs: ['#order'],
    properties: [
      {
        name: 'type',
        type: 'combo-box',
        options: ['column', 'bar', 'line', 'bubble', 'pie', 'doughnut', 'scatter', 'radar', 'polarArea'],
        default: 'column',
      },
      {name: 'data', type: 'object'},
      {name: 'options', type: 'object'},
      {name: 'plugins', type: 'array'},
      {name: 'callbackRefs', type: 'object'},
      {name: 'labels', type: 'array'},
      {name: 'stacked', type: 'toggle'},
      {name: 'legend', type: 'toggle'},
      {name: 'tooltip', type: 'toggle'},
      {name: 'animationDuration', type: 'number', min: 0},
      {name: 'tooltipMode', type: 'select', options: ['auto', 'html', 'native'], default: 'auto'},
      {name: 'style', type: 'object', create: 'html:create-style'},
      {name: 'class', type: 'string'},
    ],
    init: {'#order': [], 'style': {width: 400, height: 300}},
  },
  'chart',
  undefined,
  {meta: {[metaKey]: ChartComponent}}
);

globalFunctions.addFactory(
  null,
  {
    name: 'series',
    icon: 'svg:stock',
    tags: ['chart-series'],
    properties: [
      {name: 'dataset', type: 'object'},
      {name: 'targetDatasetIndex', type: 'number', min: 0},
      {
        name: 'type',
        type: 'combo-box',
        options: ['column', 'bar', 'line', 'bubble', 'pie', 'doughnut', 'scatter', 'radar', 'polarArea'],
      },
      {name: 'label', type: 'string'},
      {name: 'data', type: 'array'},
      {name: 'renderer', type: 'worker'},
      {name: 'rendererMode', type: 'select', options: ['replace', 'overlay'], default: 'replace'},
      {name: 'interactive', type: 'toggle', default: true},
      {name: 'callbackRefs', type: 'object'},
      {name: 'keyField', type: 'string', default: 'id'},
      {name: 'labelField', type: 'string', default: 'label'},
      {name: 'valueField', type: 'string', default: 'value'},
      {name: 'xField', type: 'string', default: 'x'},
      {name: 'yField', type: 'string', default: 'y'},
      {name: 'radiusField', type: 'string', default: 'r'},
      {name: 'markerSize', type: 'number', min: 0, default: 12},
      {name: 'fill', type: 'any'},
      {name: 'stack', type: 'string'},
      {name: 'color', type: 'color'},
    ],
    init: {},
  },
  'chart'
);
