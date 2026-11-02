# Charts

`@ticlo/chart` renders Chart.js charts as React components. A `chart:chart`
Block owns an ordered list of `chart:series` children. Each Series represents
one Chart.js dataset. Chart.js renders axes, grids, legends, lines, areas, and
native marks. A Series can optionally use a Ticlo component for bars or point
markers.

## Chart.js configuration

The Chart Block accepts the native Chart.js `data`, `options`, and `plugins`
objects. Its `type` selects the default controller. All built-in Chart.js
controllers are registered; `column` is Ticlo's alias for a vertical
Chart.js `bar`, while `bar` defaults to a horizontal bar. Native
`options.indexAxis` can override that orientation.

Chart.js `data.datasets` are kept as native datasets. Series children append
datasets in `#order`. A Series can instead set `targetDatasetIndex` to merge
with one of the native datasets. The target must exist and may be used by only
one Series. Each Series also accepts a native `dataset` object, including
its own `type` for mixed charts. Chart.js dataset and option fields such as
`parsing`, `order`, `hidden`, scales, legend position, and legend label
styles pass through.

The Chart shortcuts `labels`, `stacked`, `legend`, `tooltip`, and
`animationDuration` override only their corresponding native fields when
explicitly set. Series shortcuts `type`, `label`, `color`, `stack`,
`fill`, and `data` work the same way. Unset shortcuts leave the native
value intact. Objects merge by property, arrays replace as a whole, and
`false` is a value rather than an absent setting. Inputs are not mutated.
New Blocks do not store shortcut defaults.

For example, `options.plugins.legend.position = 'bottom'` and
`options.plugins.legend.labels.font.size = 14` remain effective when the
`legend` shortcut changes `display`. A custom legend `onClick` callback
is called; Ticlo then remembers the resulting dataset visibility by stable
Series key. Native datasets can supply an `id` for the same purpose.

## Data and renderer inputs

When Series `data` is set, it is treated as Ticlo rows and mapped into
`dataset.data`. The default row fields are `id`, `label`, `value`,
`x`, `y`, and `r`; the corresponding `*Field` properties select other
fields. Missing categories produce gaps. If Series `data` is absent,
`dataset.data` goes directly to Chart.js, so its native data formats and
`parsing` settings remain available. Use native `dataset.data` for formats
that the Ticlo row mapper does not handle, including datasets with
`parsing: false`.

The optional `renderer` is a named Ticlo worker component returning its root
Block through `#outputs.#return`. The chart runs one instance per visible
mark, keyed by `keyField` when available. Keys must be unique within a
Series. `rendererMode` is `replace` by default; `overlay` keeps the
native mark under the HTML component. Custom rendering is supported for
bar rectangles, line points, and bubble points. Other dataset types retain
their native rendering.

The renderer's `#inputs.#value` receives the following object. Fields can
also be declared in `#inputs.#custom` for direct binding:

| Input | Scope |
| --- | --- |
| `data`, `key`, `label`, `chartType`, `seriesKey`, `seriesLabel`, `datasetIndex`, `chartIndex`, `dataIndex` | Every custom mark |
| `left`, `top`, `width`, `height`, `active` | Every custom mark; geometry is in Canvas CSS pixels |
| `seriesVisible`, `interactive`, `color`, `stack` | Every custom mark; hidden Series have no rendered marks |
| `value`, `startValue`, `endValue`, `orientation` | Bars |
| `xValue`, `yValue`, `radius` | Line points and bubbles |
| `sizeValue` | Bubble source radius |

The chart sizes and positions an HTML wrapper for each mark; the returned
component's root fills it. `interactive` defaults to true. An interactive
mark receives pointer input and can show a Chart.js tooltip. Overlay gaps
pass pointer events to the Canvas, leaving its legend usable.
Set `interactive` to false when Canvas click and hover handlers or event
plugins must receive events over that mark; its Ticlo component will then
let those pointer events through.
Native object-map dataset data can still be used with a Series, but a custom
renderer requires an array so its marks can be matched to source rows.

## Plugins, callbacks, and integration

`plugins` accepts runtime Chart.js plugin objects or IDs registered with
`registerChartPlugin(id, plugin)`. To save synchronous JavaScript callbacks
in a flow, register them with `registerChartCallback(id, fn)` and use
`callbackRefs`. Chart callback paths are JSON Pointers from the full
configuration, such as
`/options/plugins/tooltip/callbacks/label` or
`/data/datasets/0/backgroundColor`. Series callback paths are relative to
its dataset, such as `/backgroundColor`. Runtime function values in native
objects also pass through, but are not portable flow data.

`tooltipMode` is `auto`, `html`, or `native`. Auto uses Ticlo's HTML
tooltip for custom marks when no native tooltip configuration is supplied;
otherwise Chart.js tooltip options are used. HTML mode uses Chart.js tooltip
content and callbacks but renders above the HTML marks. Native mode leaves
Chart.js tooltip rendering in control.

The wrapper uses a CSS transition for mark geometry. Custom-rendered charts
default to 200 ms for both Chart.js and the wrapper; an explicit animation
duration applies to both. The frames need not match exactly. When
`options.plugins = false` or line decimation is enabled for a custom line
marker, the conflicting marks fall back to native
drawing and emit a warning. A custom renderer with non-array dataset data
also falls back to native drawing. All native Chart.js settings remain available
without a custom renderer. Chart.js Canvas image exports omit HTML marks.
