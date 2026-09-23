# Blocks, properties, and flows

## Block

A `Block` owns named `BlockProperty` values and resolves bindings relative to
itself. Its `#is` value selects an optional function. Functions implemented in
TypeScript and flow-backed worker functions use the same block interface.

## Property

`BlockProperty._value` is the current runtime value; `_saved` is the value used
for persistence. Either can refer to a child block.

- `setValue()` updates both values and removes an existing binding.
- `updateValue()` and `setOutput()` update runtime state without saving it.
  An earlier saved value can remain; `_saved` is not necessarily `undefined`.
- `setBinding()` clears the saved value and subscribes to the source. The binding
  path is serialized instead of its current resolved value.

Properties dispatch changes to listeners. Owned child blocks are destroyed
when replaced, and their saved reference is cleared.

## Flow

`Flow` extends `Block` and defines a save/load boundary. `flow.save()` serializes
saved properties and bindings, skipping nested `Flow` instances. Those flows
are saved separately. `FlowHistory` provides undo/redo and tracks unsaved edits.

`flow.applyChange()` calls the persistence callback, which may return a promise.
Failed saves retain unsaved state; edits made during a pending save remain
unsaved after that save completes.

## Configs and attributes

`#` properties are engine configs and controls; `+` properties are
function-specific configs. Specialized config classes handle values such as
`#is`, `#mode`, and `#call`. Functions can use configs such as `#output` to avoid
collisions with dynamic input names.

`@` properties hold editor metadata, including `@b-xyw` for position/width and
`@b-p` for displayed property order. Saved layout attributes are distinct from
runtime status such as `@save-error`.

See [block configuration](../../../docs/block-configs.md), the
[file format](../../../.agents/skills/ticlo/file-format.md), and the
[core architecture](../../../.agents/skills/ticlo/core-package.md) for details.
