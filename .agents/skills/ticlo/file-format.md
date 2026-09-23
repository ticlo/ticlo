# Ticlo File Format

This document provides the knowledge required to understand and generate `.ticlo` files. A Ticlo file is a JSON document that describes a "Flow" and its component blocks.

## Core Concepts

A Ticlo Flow is structured as a tree of **Blocks**. The `.ticlo` file represents the root Flow, and JSON properties represent configuration, inputs, bindings, or child blocks.

Runtime state and saved file state are intentionally different. A property can have a saved value, a runtime value produced by a function, or a binding source. Only saved values and binding declarations are serialized.

### JSON Structure

The file is a JSON object (`DataMap`). Use Ticlo's `encodeSorted()` and `decode()` helpers when storing runtime values such as Luxon dates; they handle the `arrow-code` representations inside JSON.

```json
{
  "#is": "",
  "blockName": {
    "#is": "blockType",
    "param": "value"
  }
}
```

## Special Prefixes

Ticlo uses special prefixes for object keys to distinguish between different types of properties.

### 1. Configuration (`#`)

Keys starting with `#` configure the block's behavior or metadata.

- `#is`: Marks a saved child block and selects its function. A `~#is` binding can supply the function ID instead.
  - `""` (empty string): No function attached; also used when saving flows and their input/output blocks.
  - `"add"`: A registered global function ID.
  - `":double"`: A function in the current flow's `#functions` library.
  - `"+main:tools:double"`: A function in a namespace library.
  - Types such as `flow:main`, `flow:folder`, `flow:global`, `flow:inputs`, and `flow:outputs` are supplied by runtime classes. Writing these strings on an ordinary block does not construct those classes; use the corresponding flow/folder APIs.
- `#inputs`: Defines the input interface of the flow (configures the `flow:inputs` block).
- `#outputs`: Defines the output interface of the flow (configures the `flow:outputs` block).
- `#functions`: Defines a group of local functions.
- `#static`: Defines static block content used by `FlowWithStatic`/named worker flows. It is loaded before normal flow data so bindings can resolve into static content. The block reports `#is: "flow:static"` at runtime, but the saved JSON usually stores `"#is": ""` because const runtime types do not need to be serialized.
- `#disabled`: `true` to disable the block/flow.
- `#mode`: Execution mode.
  - `"auto"` (default), `"onLoad"`, `"onChange"`, `"onCall"`.
- `#sync`: `true` to run accepted `#call` triggers immediately; input changes still use the resolver queue.
- `#wait`: Whether work is still pending. Workers report readiness after it clears.
- `#priority`: Execution priority from `0` (highest) to `3` (lowest).
- `#call`: A property used to trigger the block (often used in `onCall` mode).
- `#cancel`: A property used to cancel execution.
- `#secret`: Configuration for secret values.
- `#lib`: Runtime-only metadata for editor descriptor lookup when a Flow runs with an in-flow function lib. Its runtime value is the owning Flow object. When subscribed over a client connection it serializes as a `NoSerialize` Block value whose `value` field is the Flow path. It is a read-only reference supplied by the runtime and must not be set by application code or included in saved `.ticlo` JSON.
- `#name`: (Read-only) The name of the block.

`#static` is a named-worker feature. Inline worker flow data should not create or save static blocks. At runtime, each function library flow also has a `#shared` owner block that contains one static child per function. That owner is deliberately still called `#shared`, has runtime type `flow:const`, is visible in the node tree, and must not be written to `.ticlo` JSON.

### 2. Bindings (`~`)

Keys starting with `~` (tilde) denote bindings, which link a property to another block's value.

- **Format 1 (String Path)**: `"~targetProperty": "sourcePath"`
  - Sets the property to the value at `sourcePath`.
    - **Example**: `"~value": "##.step1.#output"`
    - Sets the `value` property of the current block to the `#output` of `step1` (found in the parent scope `##`).
- **Format 2 (Helper Block)**: `"~targetProperty": { "#is": "...", ... }`
  - Defines a "Helper Block" (often an unnamed or implicitly named block).
  - The `targetProperty` is automatically bound to the `#output` of this helper block.

When saving a plain object that itself contains `#is` or `~#is`, the runtime wraps it as `{ "#is": { ... } }` so it will reload as a value rather than as a child block.

### 3. Context (`^`)

Keys starting with `^` are context properties. They typically connect to global or parent context definitions.

### 4. Attributes (`@`)

Keys starting with `@` are editor attributes, such as layout, positioning, or comments. They are not function inputs. Saved layout attributes should be preserved when editing a flow file. Runtime status attributes such as `@has-change` and `@save-error` are not part of the saved layout.

- `@b-p`: Block properties layout instructions (ordering of properties in the editor).
- `@b-pself`: Boolean/toggle, default `false`. When `true`, the editor shows the block's own property in the footer for binding from the block path (for example `flow.block1`).
- `@b-xyw`: Layout coordinates `[x, y, width]`.

### 5. Function-specific configuration (`+`)

Keys starting with `+` configure a particular function, for example `+use` and `+state` on `worker`. Inline worker definitions are plain data values: wrap them with an object-valued `#is` so loading does not create a child block in the config property.

## Path Navigation

When defining bindings, use these references:

- `#`: The current block.
- `##`: The parent block.
- `#flow`: The current Flow itself.
- `#+`: The current namespace root, used when a relative binding crosses namespace-managed flows.
- `block.prop`: Navigation dot-syntax.

## Examples

### Basic Arithmetic Flow

A flow that adds two numbers.

```json
{
  "#is": "",
  "#inputs": {
    "#is": "",
    "num1": 2,
    "num2": 3
  },
  "adder": {
    "#is": "add",
    "~0": "##.#inputs.num1",
    "~1": "##.#inputs.num2"
  },
  "#outputs": {
    "#is": "",
    "~result": "##.adder.#output"
  }
}
```

### Inline Worker

This flow passes `4` into an inline worker and receives `8` at `double.#output`.
The outer `#is` under `+use` wraps the worker definition as a plain value.

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

### Local Function Definition

`#functions` stores custom worker functions local to a flow. Blocks can reference them with `:functionName`.

```json
{
  "#is": "",
  "#functions": {
    ":double": {
      "type": "worker",
      "worker": {
        "#is": "",
        "#inputs": {"#is": "", "#custom": [{"name": "value", "type": "number"}]},
        "#outputs": {"#is": "", "~#output": "##.multiply.#output"},
        "multiply": {"#is": "multiply", "~0": "##.#inputs.value", "1": 2}
      }
    }
  },
  "useIt": {"#is": ":double", "value": 4}
}
```

## How to Edit

1.  **Adding a Block**: Add a new key to the JSON object.
    ```json
    "newBlock": {
      "#is": "functionName",
      "inputProp": "value"
    }
    ```
2.  **Creating a Link**: Use the `~` prefix.
    ```json
    "~inputProp": "##.sourceBlock.#output"
    ```
3.  **Setting Input Values**: Set the property directly.
    ```json
    "inputProp": 123
    ```

## Validation Checklist

- **Blocks vs Values**: Objects intended as child blocks need `#is` or `~#is`. Without either marker, a nested object is loaded as a plain value. The top-level object passed to `Flow.load()` is already flow data.
- **Ambiguous Values**: If a plain object value must contain `#is` or `~#is`, wrap it so the outer value is `{ "#is": <plain object> }`.
- **Bindings**: Binding paths (`~`) generally point to valid sources, but the runtime does **not** enforce this. An invalid path simply results in `undefined` without throwing an error.
