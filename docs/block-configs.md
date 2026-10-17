# Block configuration

Implementation: [BlockConfigs.ts](../packages/core/block/BlockConfigs.ts) and
[Block.ts](../packages/core/block/Block.ts). For saved block markers, function IDs,
and object wrappers, see the [file format](../.agents/skills/ticlo/file-format.md).

## `#mode` and `#disabled`

`#mode: auto` uses the function's default mode.

| Trigger          | `onLoad` | `onChange` | `onCall` |
| ---------------- | -------- | ---------- | -------- |
| Block loaded     | Yes      | No         | No       |
| Input changed    | Yes      | Yes        | No       |
| Accepted `#call` | Yes      | Yes        | Yes      |

`#disabled: true` disables execution; `disabled` is not a mode.
Functions can reject calls through `onCall()`.

## `#call` and `#sync`

An accepted `#call` queues the block; `#sync: true` runs it immediately without
changing input-change scheduling. A pure function in an input-driven mode can
skip repeated synchronous calls when no input change is pending.

`null`, `undefined`, `false`, and `WAIT` do not trigger calls. Ordinary `Event`
instances trigger only in their creation resolver loop; specialized events may
override this.

## `#custom` and `#optional`

`#custom` is an array of additional property descriptors. `#optional` is an array
of optional property names to show in the editor. The
[property API](../packages/core/property-api) maintains these lists and values.

## Initial values

New-block data from `getDefaultFuncData()` includes each property's descriptor
`init` value. A function descriptor can also provide an `init` object keyed by
property name, which overrides property-level initial values. This lets functions
share property descriptors while supplying different initial values. Function-level
initial objects and arrays are copied for each new block.

These values apply when creating blocks through the editor; loading saved blocks
does not add missing initial values. A property descriptor's `default` controls
editor display only.

## Runtime references

Read-only; never write these into flow files:

| Property | Reference                                      |
| -------- | ---------------------------------------------- |
| `#`      | Current block                                  |
| `##`     | Parent block                                   |
| `#flow`  | Containing flow                                |
| `#lib`   | Function library's owning flow, when available |
| `#name`  | Block name                                     |
| `#+`     | Namespace root                                 |

## Worker data

The `worker` function selects its source through `#use` and controls its lifecycle
through `#state` (`on`, `off`, `disable`, or `lazy`). Object-building functions use
`#extend` as a base object. These function-specific settings share the `#` config
prefix with engine settings; `+` identifies namespaces in paths and function IDs.

Workers receive inputs through `#inputs` and publish through `#outputs`.
`#input` and `#output` are conventional default names; named IO is supported.

## Worker static content and shared ownership

Named workers expose static content through `#static`. The function library's
owning flow keeps that content under `#shared`, with one child per function.

| Property | Where it appears | Runtime value | Persistence |
| --- | --- | --- | --- |
| `#static` | `WorkerFlow` and `FlowEditor`, through `FlowWithStatic` | Reference to the function's `StaticBlock` (`flow:static`) | Contents saved under `#static` in the worker definition, with `#is: ""` |
| `#shared` | Function library's owning flow | `SharedBlock` (`flow:const`) containing the library's static blocks | Runtime container; never serialized |

A worker's `#static` references the same Block as
`libraryFlow.#shared.<encoded local function ID>`. All instances and editors of
that function reference the same static block. Different function libraries own
separate `#shared` containers, even when their local function IDs match.

The name `FlowWithStatic` follows the `#static` property it adds. `SharedBlock`
names the owning container; `StaticBlock` names each function's content.

Static content loads before the worker's other data so bindings can resolve it.
Destroying a worker instance detaches its reference; the static block remains
owned by `#shared`. Replacing or deleting the function invalidates the block.
Inline workers do not support static content.

See [StaticBlock.ts](../packages/core/block/StaticBlock.ts) and
[worker architecture](../.agents/skills/ticlo/worker-architecture.md#flow-classes-and-static-content).

## Component root

`#main` is a flow's UI root Block and is included in its node tree. `TicloComp`
uses a registered React renderer when available; otherwise it renders the Block
or React element in `#main`. `#output` remains the default data output.

A reusable UI worker publishes its root as a named `#main` output:

```json
{
  "#is": "",
  "#main": {"#is": "react:div", "content": "Hello"},
  "#outputs": {
    "#is": "",
    "#custom": [{"name": "#main", "type": "block"}],
    "~#main": "##.#main"
  }
}
```

The worker instance's `#main` references the same root Block.

When saving a worker flow or worker editor with an owned `#main` Block and an
existing `#outputs` Block, Ticlo adds the binding above if the output has no saved
`#main` value or binding.
It also adds the `block` custom property if missing, so the worker descriptor
exposes the output. Existing output definitions and descriptors are preserved.

When saving a worker function, Ticlo copies allowed tags from the function of the
Block directly bound to `#outputs.#main` into the worker's `#desc.tags`, preserving
existing tags without duplicates. Currently, only `react-comp` is copied.
When these conditions hold and `#inputs.#custom` declares `#order`, the worker's
`#desc.childrenTags` is also copied from that function.

A `#order` string array names children on the Block holding that value. When
`#inputs` receives a declared `#order` input, its runtime value is a `BlockOrder`
containing the original `owner` and `order` list. Forwarding it through another
worker retains that owner. Consumers resolve the names on the owner, even when
the receiving layout has properties with the same names. Plain object inputs
retain the input object as their owner. This runtime reference is not persisted
or transferred as an editable value. The node tree only uses string-array orders
for sorting.

Ordered insertion and movement only edit local string-array orders. The commands
reject forwarded `BlockOrder` values and bound `#order` properties before changing
any blocks. An absent target order can be created on insertion. Deleting a child
leaves forwarded or bound orders unchanged. The designer stage supports inserting
new children; reordering existing children is handled by the node tree.

## Worker readiness

`#wait` signals pending work. Clearing it lets `WorkerFlow` report readiness
after resolution; setting it on `#outputs` forwards readiness to the flow.
`map`, `multi-worker`, and `handler` use this when collecting results or reusing
workers. See [worker architecture](../.agents/skills/ticlo/worker-architecture.md)
for sources and host behavior.
