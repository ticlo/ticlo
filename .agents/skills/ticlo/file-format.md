# Ticlo file format

A `.ticlo` file is a JSON object (`DataMap`) describing a flow's block tree.
Only saved values and binding declarations serialize, not computed outputs.
Use `encodeSorted()`/`decode()` for values such as Luxon dates encoded by `arrow-code`.

## Blocks and values

A nested object with `#is` or `~#is` is child block data; without either marker,
it is a plain value. The root passed to `Flow.load()` is already flow data.
Wrap a plain object containing those markers as `{"#is": <object>}` to prevent
it loading as a child block. Inline worker definitions need this wrapper too.

### Function IDs

| Saved `#is` | Meaning |
| --- | --- |
| `""` | No function; also used for saved flows and IO blocks |
| `"add"` | Global function |
| `":double"` | Current flow's `#functions` library |
| `"+main:tools:double"` | Namespace library function |

`~#is` can bind the function ID. Types such as `flow:main`, `flow:folder`,
`flow:inputs`, and `flow:outputs` come from runtime classes; assigning their
strings to ordinary blocks does not construct those classes. Use flow/folder APIs.

## Property prefixes

| Prefix | Purpose |
| --- | --- |
| none | Normal inputs/outputs |
| `#` | Engine controls and configuration |
| `~` | Binding path or helper block |
| `^` | Context linked to parent/global context |
| `@` | Editor attributes, not function inputs |
| `+` | Function-specific config, such as worker `+use`/`+state` |

### Configuration (`#`)

- `#inputs` / `#outputs`: flow IO blocks.
- `#functions`: local worker definitions (example below).
- `#static`: named-worker static content, loaded before normal data. Saved with
  `#is: ""`, runtime type `flow:static`. Inline workers do not support it.
  The runtime owner `#shared` (`flow:const`) is never serialized; see
  [static ownership](./worker-architecture.md#flow-classes-and-static-content).
- `#priority`: `0` (highest) through `3` (lowest).
- `#cancel`: cancellation trigger; `#secret`: secret configuration.

See [block configuration](../../../docs/block-configs.md) for `#mode`, `#disabled`,
`#call`, `#sync`, `#wait`, custom/optional properties, and read-only references.
Never save runtime references such as `#lib` or `#name`.

### Bindings (`~`)

`"~value": "##.step1.#output"` binds `value` to sibling `step1`'s output.
`"~value": {"#is": "...", ...}` creates a helper block whose `#output` drives
`value`. Unresolved paths produce `undefined` without throwing.

Paths use dots: `#` is the current block, `##` its parent, `#flow` the containing
flow, and `#+` its namespace root.

### Attributes (`@`)

Preserve saved layout when editing:

- `@b-p`: displayed property order.
- `@b-pself`: show the block's own property in its footer for binding from the
  block path; defaults to `false`.
- `@b-xyw`: `[x, y, width]`.

`@has-change` and `@save-error` are runtime status, not saved layout.

## Examples

### Arithmetic

```json
{
  "#is": "",
  "#inputs": {"#is": "", "num1": 2, "num2": 3},
  "adder": {"#is": "add", "~0": "##.#inputs.num1", "~1": "##.#inputs.num2"},
  "#outputs": {"#is": "", "~result": "##.adder.#output"}
}
```

### Inline worker

Passes `4` in and emits `8` at `double.#output`. The outer `#is` under `+use`
wraps the definition as a value.

```json
{
  "#is": "",
  "double": {
    "#is": "worker",
    "value": 4,
    "+use": {
      "#is": {
        "#is": "",
        "#inputs": {"#is": "", "#custom": [{"name": "value", "type": "number"}]},
        "multiply": {"#is": "multiply", "~0": "##.#inputs.value", "1": 2},
        "#outputs": {"#is": "", "~#output": "##.multiply.#output"}
      }
    }
  }
}
```

### Local function

```json
{
  "#is": "",
  "#functions": {
    ":double": {
      "type": "worker",
      "worker": {
        "#is": "",
        "#inputs": {"#is": "", "#custom": [{"name": "value", "type": "number"}]},
        "multiply": {"#is": "multiply", "~0": "##.#inputs.value", "1": 2},
        "#outputs": {"#is": "", "~#output": "##.multiply.#output"}
      }
    }
  },
  "useIt": {"#is": ":double", "value": 4}
}
```
