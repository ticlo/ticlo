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
