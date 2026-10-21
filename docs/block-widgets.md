# Block widgets

Block widgets add a control or a data display below a block's header. Choose
`@b-widget` in the block's attributes, then configure the attributes for that
widget. Widgets appear when the block is expanded; a function's full block view
takes precedence over `@b-widget`.

| `@b-widget` | Purpose |
| --- | --- |
| `none` | Default; no widget |
| `button` | Call the block's function or send an object to a field |
| `slider` | Read and edit a numeric field |
| `note` | Display Markdown or structured data |

Widget settings use editor attributes (`@` properties) and are saved with the
block. Examples below show individual block definitions. See the
[file format](../.agents/skills/ticlo/file-format.md) for flow structure and binding
syntax, and [block configuration](./block-configs.md) for execution modes.

## Button

Set `@b-widget: 'button'` to add a button.

| Attribute | Type | Behavior when omitted |
| --- | --- | --- |
| `@b-w-label` | String | Display the field name, or `#call` when no field is set |
| `@b-w-field` | String | Call the block's function; an empty string has the same effect |
| `@b-w-value` | Object | Send `{}` when updating a field |

Without a field, clicking uses the same call command as the event editor. For
example, this block runs its addition when the button is clicked:

```json
{
  "#is": "add",
  "#mode": "onCall",
  "0": 1,
  "1": 2,
  "@b-widget": "button",
  "@b-w-label": "Calculate"
}
```

With a field, clicking sends the payload through `updateValue` to that field on
the block. This updates the runtime value while preserving its saved value.
Each click deep-copies the payload so repeated clicks trigger updates even on
local connections that pass objects by reference. The payload is used only when
a field is set.

```json
{
  "#is": "",
  "@b-widget": "button",
  "@b-w-label": "Refresh",
  "@b-w-field": "request",
  "@b-w-value": {
    "action": "refresh",
    "options": {"force": true}
  }
}
```

Omit `@b-w-label` to label this button `request`. Omit `@b-w-value` to send a
fresh empty object on each click. The button follows the connection's edit policy
for calling the function or updating the target field.

## Slider

Set `@b-widget: 'slider'` and choose a numeric field with `@b-w-field`.

| Attribute | Type | Default |
| --- | --- | --- |
| `@b-w-field` | String | No target field |
| `@b-w-min` | Number | `0` |
| `@b-w-max` | Number | `100` |
| `@b-w-step` | Number | `1` |

The slider reads the current value from the target field on the block. Moving it
uses `setValue`, so the selected number becomes the field's saved value. Configure
a positive step and a maximum greater than the minimum.

```json
{
  "#is": "",
  "value": 5,
  "@b-widget": "slider",
  "@b-w-field": "value",
  "@b-w-min": 0,
  "@b-w-max": 10,
  "@b-w-step": 0.5
}
```

The slider is disabled when its target field has a binding or the connection's
edit policy prevents writing that field.

## Note

Set `@b-widget: 'note'` to display a note or inspect a value on an existing block.

| Attribute | Type | Default |
| --- | --- | --- |
| `@b-note` | Any | No content |
| `@b-note-mode` | Select: `markdown`, `json`, `yaml` | `markdown` |

Use a string for Markdown content:

```json
{
  "#is": "",
  "@b-widget": "note",
  "@b-note": "## Notes\nClick **Refresh** to request new data."
}
```

Use `json` or `yaml` to display structured data. Bind `@b-note` to another property
to inspect a value as it changes. This example displays the block's output:

```json
{
  "#is": "add",
  "0": 1,
  "1": 2,
  "@b-widget": "note",
  "@b-note-mode": "json",
  "~@b-note": "#output"
}
```

The standalone `note` function (`#is: 'note'`) provides its own full block view and
uses `input` and `mode` properties. The `note` widget uses `@b-note` and
`@b-note-mode` attributes on the block it decorates.

## Height and binding alignment

Widget areas occupy whole field rows. Each field row is 24px high; the editor
rounds widget height up to a multiple of 24px and uses that height to position
the fields and binding wires below it. A widget's reported height must include
its content, padding, and border so its rendered layout matches the wire
positions. Notes update their height when their content changes.
