# Block widgets

`@b-widget` adds a control below an expanded Block's header. A function's full
block view takes precedence. Settings are saved editor attributes; `none` adds
no widget. See [flow format](flow-format.md) for binding syntax.

## Button

`@b-widget: 'button'` calls the function when no `@b-w-field` is set. With a field,
it sends `@b-w-value` through `updateValue`, preserving the saved value. Each click
deep-copies the object payload; omission sends a fresh empty object. `@b-w-label`
sets the label. Calling and updating follow their respective connection policy.

```json
{
  "#is": "",
  "@b-widget": "button",
  "@b-w-label": "Refresh",
  "@b-w-field": "request",
  "@b-w-value": {"action": "refresh"}
}
```

## Slider

`@b-widget: 'slider'` reads and edits `@b-w-field`. It uses `setValue`, so edits
are persisted. Bound fields and fields blocked by policy cannot be edited.
`@b-w-min`, `@b-w-max`, and `@b-w-step` configure the numeric range; step must be
positive and maximum greater than minimum.

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

## Note

`@b-widget: 'note'` displays `@b-note`. `@b-note-mode` chooses `markdown`, `json`,
or `yaml`. Bind the content to inspect a changing value:

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

The standalone `note` function provides its own block view using `input` and
`mode`; the note widget decorates an existing Block.
