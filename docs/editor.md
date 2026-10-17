# Property editors

A property's descriptor `type` selects its editor. The registry is in
[value/index.ts](../packages/editor/property/value/index.ts), with basic types
defined in [DynamicEditor.tsx](../packages/editor/property/value/DynamicEditor.tsx).

| Descriptor type | Editor |
| --- | --- |
| `number` | Numeric input |
| `string` | Text input with an expanded editor |
| `toggle` | Boolean switch; two `options` can map it to other values |
| `select`, `multi-select` | One or several values from `options` |
| `combo-box` | Selection with text entry |
| `radio-button` | Options displayed as buttons |
| `password` | Masked text input |
| `color` | Color picker; changes produce hex strings, with optional alpha |
| `date` | Luxon `DateTime` picker; `showTime: false` hides time |
| `date-range` | Date range picker |
| `time` | Time picker |
| `object`, `array` | Structured value editor |
| `table` | Structured editor for arrays of objects or arrays |
| `type` | Function selector |
| `worker` | Worker source selector and flow editor |
| `event` | Event controls |
| `schedule` | Schedule editor |
| `any` | Dynamic editor selected from the value or descriptor's `types` |
| `none` | Read-only value display |

`service` uses a dedicated binding editor in
[PropertyEditor.tsx](../packages/editor/property/PropertyEditor.tsx).
Unknown types fall back to a read-only display. Use `toggle` for booleans and
`date` for dates; `bool`, `datetime`, and `js` are not registered value-editor types.

Descriptors, bindings, and connection edit policies determine whether a value
can be edited. For local function descriptors, editor components also need the
owning function-library flow path; see the
[connection architecture](../.agents/skills/ticlo/core-package.md#connection-layer).

Object properties with `create` can convert a stored object into a helper of that
function type, or convert that helper's output back into a stored object. Each
conversion reads the full current value, then makes one write per selected block.
Creating the helper also establishes its output binding; setting the object value
removes both the binding and helper. Each block keeps its own value when several
blocks are selected. Optional fields become enabled helper properties; custom
object fields become custom properties, with remaining fields preserved in
`#extend`. Functions with `recipient` receive the whole object in that property.

## Optional property suggestions

Functions with optional properties can declare `optionalSuggestions`, an array
of up to ten property names. An empty search uses these names to seed an empty
history, in array order, with one use each. Suggestions do not enable properties.

The editor saves search history in localStorage per function type; flow-local
types also include their function-library path. Each enable action records one
use, including when multiple blocks are selected. History retains up to 32 names.
Suggestions show the five most recent names followed by the five most frequently
used remaining names, with recency breaking frequency ties. When history is full,
the least frequently used name outside the ten most recent names is removed;
the oldest name breaks eviction ties.

## Table editor

Use `type: 'table'` with an explicit `rowType` and `columns`. A column's `type`
selects its cell editor; object rows use string keys, array rows use nonnegative
integer indices. Column titles are optional and default to the key.

```ts
{
  name: 'options',
  type: 'table',
  rowType: 'object',
  columns: [
    {key: 'label', title: 'Label', type: 'string'},
    {key: 'value', title: 'Value', type: 'number'},
    {key: 'disabled', title: 'Disabled', type: 'toggle', init: false},
  ],
}
```

Edits use a draft and submit the entire array through the parent property's
change handler. Unlisted fields are preserved; new rows use column `init`
values, while `default` only affects display. Connected properties load their
complete value before editing. External changes require reloading the draft
before submitting it.

Cells reuse value editors. Connected worker cells support function selection
and flow editing: inline workers stay in the draft until submission; named
workers save to their function library. Local function lookup uses `funcLib`.
Editors requiring a separate Block property path, including nested object/array
editing, remain read-only. Property and column edit restrictions apply.

## File manager

`FileManager` manages remote files through `@ticlo/file-client`. Pass a client
and a project / namespace ID; the panel is confined to `proj/<project>`, and
cannot rename, copy, move, or delete the project root. Use `#root` for the global
namespace. Changing either the client or project clears selection and clipboard
state and cancels outstanding requests and confirmations.

```tsx
import {FileManager} from '@ticlo/editor';
import {TicloFileClient} from '@ticlo/file-client';
import '@ticlo/editor/style/index.css';

const client = new TicloFileClient({baseURL: 'http://127.0.0.1:8010/file'});

<FileManager client={client} project="main" style={{height: 500}} />;
```

The panel supports file and folder operations, including recursive folder copies
and uploads that preserve empty folders. Copies include entries exposed by the
file-server listing API. Same-directory copies receive an unused
numbered name. Replacing an existing entry requires confirmation; replacing a
folder also removes its contents. The clipboard belongs to the panel.

Preview supports images and common text, source-code, and configuration formats.
Supported files smaller than 100,000 bytes load automatically; larger files need
an explicit request. Text previews are read-only and show source, including HTML
and JavaScript. Unsupported formats, including Ticlo / designer files, provide
metadata and download only. `defaultPreview` controls the initial preview state.

`onSelect` receives the selected `FileEntry` objects. `onChange` fires after a
mutation attempt and directory refresh, including partial failures. These are
raw file operations; consumers must reload affected runtime flows themselves.
The playground and designer show a Files panel when configured with remote
storage, using the project selected by their `project` URL parameter.

## Themes

Editor styles and rc-dock's `rc-dock-antd.css` consume Ant Design CSS variables.
Use the exported `theme` or `darkTheme` from `@ticlo/editor/style/theme.ts` with
`ConfigProvider`, with Ant Design's `App` wrapping the editor inside it. `App`
provides the matching CSS variable scope and base typography, including rc-dock.
Custom popups and drag previews mounted outside `App` need their own theme scope.
These themes use `zeroRuntime`; load the Ant Design CSS generated by
`pnpm build-antd-style`, which includes both themes' component variables.

Both themes derive selection tokens with `ticloThemeAlgorithm`. Ant Design emits
their resolved color values in the same scope as its own CSS variables. Custom
algorithm lists should include `ticloThemeAlgorithm` last.

Ticlo-specific colors can be overridden in the same scope:

| CSS variable | Default |
| --- | --- |
| `--ant-ticl-selection-color` | Ant Design `colorPrimary` |
| `--ant-ticl-selection-bg` | Ant Design `colorPrimary` at 10% opacity |
| `--ticl-wire-color` | Ant Design `colorTextTertiary` |
| `--ticl-stage-grid-color` | Ant Design `colorTextTertiary` |
| `--ticl-code-keyword-color` | Ant Design `colorPrimary` |
| `--ticl-code-string-color` | Ant Design `colorSuccess` |
| `--ticl-code-number-color` | Ant Design `colorWarning` |
| `--dock-drop-indicator-bg` | Ant Design `colorPrimary` |

Editor components include light-color fallbacks when Ant Design variables are
absent. Designer pages and note views can still specify their own content colors.
