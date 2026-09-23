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
