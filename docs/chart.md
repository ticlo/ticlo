# Charts

`@ticlo/chart` renders charts with Chart.js. A `chart:chart` Block is a React
component. Its ordered `chart:series` children are Chart.js datasets; a Series
is data and configuration, not a separate page element. The `#order` list sets
dataset order. A chart can contain Column, Bar, Line, Bubble, Pie, or Doughnut
data. Column and Bar share Chart.js's bar controller, with different index axes.
Line Series can set `fill` to `origin`, `start`, `end`, or `stack` to create an area.
`fill` can also name another Series in the same chart; the chart resolves that
name to the current dataset index. Pie and Doughnut currently use the first
Series and are drawn entirely by Chart.js.

## Data

Each Series has a `data` array. A row is an object, or a primitive normalized
to `{value: primitive}`. `labelField`, `valueField`, `xField`, `yField`, and
`radiusField` select the row properties; their defaults are `label`, `value`,
`x`, `y`, and `r`. `keyField` defaults to `id`. Within a categorical Series,
labels must be unique. `chart.labels` fixes category order when provided;
otherwise categories follow their first occurrence across the Series. Missing
categories produce gaps. Bubble `r` is a radius in CSS pixels, as in Chart.js.

For a custom renderer, give the Series `renderer` property a named Ticlo worker
component. Its worker must return its root Block through `#outputs.#return`.
The chart runs one instance per visible data item, keyed by `keyField` when
available. An item without that field uses its category label or row index as
its key. Supply unique keys when rows may move or repeat. The renderer's
`#inputs.#value` receives the full object below; individual fields can be
declared in `#inputs.#custom` for direct bindings:

| Input | Scope |
| --- | --- |
| `data`, `key`, `label`, `chartType`, `seriesKey`, `seriesLabel`, `datasetIndex`, `chartIndex`, `dataIndex` | Every custom mark |
| `left`, `top`, `width`, `height`, `active` | Every custom mark; geometry is in Canvas CSS pixels |
| `seriesVisible`, `interactive`, `color`, `stack` | Every custom mark; hidden Series have no rendered marks |
| `value`, `startValue`, `endValue`, `orientation` | Column and Bar |
| `xValue`, `yValue`, `radius` | Line points and Bubble |
| `sizeValue` | Bubble source radius |

The chart positions and sizes an HTML wrapper for each mark. The component
returned by the worker should have one DOM root; that root fills the wrapper.
Custom renderers replace only rectangular Column/Bar marks, Line point markers,
and Bubble points. Chart.js continues to draw lines, area fills, axes, grids,
legends, and native Series. Pie and Doughnut do not use custom renderers.

## Interaction and animation

`interactive` defaults to true on a Series. When it has a renderer, the mark
receives pointer input and its Ticlo component handlers can run. The chart
also maps pointer movement back to Chart.js active elements and shows an HTML
tooltip above the marks. Setting `interactive` to false lets pointer events
pass through to the Canvas. The overlay outside mark wrappers always lets
events through, so the Canvas legend remains usable.

Existing marks use CSS transitions for position and size changes. The chart
and wrapper use the same duration and linear easing, but their frames need
not align exactly. Initial marks, removed marks, resize, and visibility changes
do not animate through the overlay. `animationDuration` defaults to 300 ms.
Automatic Chart.js decimation is disabled because it changes data indices used
to match rows with renderer instances. Chart.js Canvas image exports contain
the Canvas layer only, not HTML renderers.
