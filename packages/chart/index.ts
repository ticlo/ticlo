import {globalFunctions} from '@ticlo/core';
import {metaKey} from '@ticlo/react';
import {ChartComponent} from './ChartComponent.tsx';

export {ChartComponent} from './ChartComponent.tsx';
export {buildChartData, readChartOptions, readChartSeries} from './ChartData.ts';

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
        type: 'select',
        options: ['column', 'bar', 'line', 'bubble', 'pie', 'doughnut'],
        default: 'column',
      },
      {name: 'labels', type: 'array'},
      {name: 'stacked', type: 'toggle', default: false},
      {name: 'legend', type: 'toggle', default: true},
      {name: 'tooltip', type: 'toggle', default: true},
      {name: 'animationDuration', type: 'number', min: 0, default: 300},
      {name: 'style', type: 'object', create: 'html:create-style'},
      {name: 'class', type: 'string'},
    ],
    init: {'type': 'column', '#order': [], 'style': {width: 400, height: 300}},
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
      {name: 'label', type: 'string'},
      {name: 'data', type: 'array'},
      {name: 'renderer', type: 'worker'},
      {name: 'interactive', type: 'toggle', default: true},
      {name: 'keyField', type: 'string', default: 'id'},
      {name: 'labelField', type: 'string', default: 'label'},
      {name: 'valueField', type: 'string', default: 'value'},
      {name: 'xField', type: 'string', default: 'x'},
      {name: 'yField', type: 'string', default: 'y'},
      {name: 'radiusField', type: 'string', default: 'r'},
      {name: 'markerSize', type: 'number', min: 0, default: 12},
      {name: 'fill', type: 'string'},
      {name: 'stack', type: 'string'},
      {name: 'color', type: 'color'},
    ],
    init: {label: 'Series', data: [], interactive: true},
  },
  'chart'
);
