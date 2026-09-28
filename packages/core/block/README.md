# Blocks and properties

`Block` owns named `BlockProperty` values, resolves bindings relative to itself,
and hosts an optional `#is` function (TypeScript or flow-backed).

`BlockProperty._saved` holds the persisted value; `_value` holds the runtime
value. Either can refer to a child block.

| Method | Effect |
| --- | --- |
| `setValue()` | Updates both values and removes the binding. |
| `updateValue()`, `setOutput()` | Update runtime state; an earlier saved value can remain. |
| `setBinding()` | Clears the saved value and subscribes to the source; serializes the path. |

Properties notify listeners. Replacing an owned child destroys it and clears its
saved reference.

See [core architecture](../../../.agents/skills/ticlo/core-package.md) for flow
boundaries and execution, [file format](../../../.agents/skills/ticlo/file-format.md)
for saved data, and [block configuration](../../../docs/block-configs.md) for controls.
