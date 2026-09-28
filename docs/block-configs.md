# Block configuration

Implementation: [BlockConfigs.ts](../packages/core/block/BlockConfigs.ts) and
[Block.ts](../packages/core/block/Block.ts). For saved block markers, function IDs,
and object wrappers, see the [file format](../.agents/skills/ticlo/file-format.md).

## `#mode` and `#disabled`

`#mode: auto` uses the function's default mode.

| Trigger | `onLoad` | `onChange` | `onCall` |
| --- | --- | --- | --- |
| Block loaded | Yes | No | No |
| Input changed | Yes | Yes | No |
| Accepted `#call` | Yes | Yes | Yes |

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

## Runtime references

Read-only; never write these into flow files:

| Property | Reference |
| --- | --- |
| `#` | Current block |
| `##` | Parent block |
| `#flow` | Containing flow |
| `#lib` | Function library's owning flow, when available |
| `#name` | Block name |
| `#+` | Namespace root |

## Worker data and readiness

Workers receive inputs through `#inputs` and publish through `#outputs`.
`#input` and `#output` are conventional default names; named IO is supported.

`#wait` signals pending work. Clearing it lets `WorkerFlow` report readiness
after resolution; setting it on `#outputs` forwards readiness to the flow.
`map`, `multi-worker`, and `handler` use this when collecting results or reusing
workers. See [worker architecture](../.agents/skills/ticlo/worker-architecture.md)
for sources and host behavior.
