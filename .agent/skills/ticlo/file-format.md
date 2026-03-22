# Ticlo File Format

This document provides the knowledge required to understand and generate `.ticlo` files. A Ticlo file is a JSON document that describes a "Flow" and its component blocks.

## Core Concepts

A Ticlo Flow is structured as a tree of **Blocks**. The `.ticlo` file represents the root Flow, and JSON properties represent configuration, inputs, bindings, or child blocks.

### JSON Structure

The file is a standard JSON object (`DataMap`).

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

- `#is`: **Required**. Specifies the type/class of the block.
  - `""` (empty string): No special function attached to the block, usually used for flow's root block.
  - `"flow:folder"`: A folder for organizing flows.
  - `"flow:namespace"`: A namespace definition.
  - `"flow:global"`: Global settings.
  - `"flow:inputs"`: The inputs definition block.
  - `"flow:outputs"`: The outputs definition block.
  - `"function_name"`: For child blocks, the identifier of the function (e.g., `"math:add"`, `"test:assert"`).
- `#inputs`: Defines the input interface of the flow (configures the `flow:inputs` block).
- `#outputs`: Defines the output interface of the flow (configures the `flow:outputs` block).
- `#functions`: Defines a group of local functions.
- `#disabled`: `true` to disable the block/flow.
- `#mode`: Execution mode.
  - `"auto"` (default), `"onLoad"`, `"onChange"`, `"onCall"`.
- `#sync`: `true` to force synchronous execution.
- `#wait`: Initial waiting state.
- `#priority`: Number indicating execution priority.
- `#call`: A property used to trigger the block (often used in `onCall` mode).
- `#cancel`: A property used to cancel execution.
- `#secret`: Configuration for secret values.
- `#name`: (Read-only) The name of the block.

### 2. Bindings (`~`)

Keys starting with `~` (tilde) denote bindings, which link a property to another block's value.

- **Format 1 (String Path)**: `"~targetProperty": "sourcePath"`
  - Sets the property to the value at `sourcePath`.
    - **Example**: `"~value": "##.step1.#output"`
    - Sets the `value` property of the current block to the `#output` of `step1` (found in the parent scope `##`).
- **Format 2 (Helper Block)**: `"~targetProperty": { "#is": "...", ... }`
  - Defines a "Helper Block" (often an unnamed or implicitly named block).
  - The `targetProperty` is automatically bound to the `#output` of this helper block.

### 3. Context (`^`)

Keys starting with `^` are context properties. They typically connect to global or parent context definitions.

### 4. Attributes (`@`)

Keys starting with `@` are attributes. These are used primarily by the Ticlo Dataflow Editor (e.g., for layout, positioning, or comments) and do **not** affect the runtime logic of the flow.

- **Important**: If these keys are removed, the flow's execution behavior remains exactly the same.
- `@b-p`: Block properties layout instructions (ordering of properties in the editor).
- `@b-xyw`: Layout coordinates `[x, y, width]`.

## Path Navigation

When defining bindings, use these references:

- `#`: The current block.
- `##`: The parent block.
- `###`: The Flow itself.
- `block.prop`: Navigation dot-syntax.

## Examples

### Basic Arithmetic Flow

A flow that adds two numbers.

```json
{
  "#is": "",
  "#inputs": {
    "num1": 0,
    "num2": 0
  },
  "adder": {
    "#is": "math:add",
    "~0": "##.#inputs.num1",
    "~1": "##.#inputs.num2"
  },
  "#outputs": {
    "~result": "##.adder.#output"
  }
}
```

### Worker Flow Definition

Example of a worker definition with custom types.

```json
{
  "#is": "worker",
  "#custom": [{"name": "inputA", "type": "number", "pinned": true}],
  "internalLogic": {
    "#is": "someLogic",
    "~val": "##.inputA"
  }
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

- **Blocks vs Values**: Does every object intended to be a Block have an `#is` property? (Objects without `#is` are treated as plain JSON values).
- **Bindings**: Binding paths (`~`) generally point to valid sources, but the runtime does **not** enforce this. An invalid path simply results in `undefined` without throwing an error.
