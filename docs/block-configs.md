# Block configuration

See [BlockConfigs.ts](../packages/core/block/BlockConfigs.ts) for config classes
and [Block.ts](../packages/core/block/Block.ts) for execution behavior.

## `#is`

A string selecting the function attached to a block: a global ID such as `add`,
a local function such as `:double`, or a namespace function such as
`+main:tools:double`. An empty string means no function.

Runtime types such as `flow:main`, `flow:inputs`, and `flow:worker` are supplied
by the owning block class. They are not ordinary function IDs. In saved data,
an object-valued `#is` wraps a plain object value; it does not define a subflow.
See the [file format](../.agents/skills/ticlo/file-format.md).

## `#mode` and `#disabled`

`#mode` accepts `auto`, `onLoad`, `onChange`, or `onCall`. `auto` uses the
function's default mode.

| Trigger | `onLoad` | `onChange` | `onCall` |
| --- | --- | --- | --- |
| Block loaded | Yes | No | No |
| Input changed | Yes | Yes | No |
| Accepted `#call` | Yes | Yes | Yes |

Use `#disabled: true` to disable execution. `disabled` is not a mode value.
Individual functions can reject calls through their `onCall()` handler.

## `#call` and `#sync`

An accepted `#call` queues the block in the resolver. With `#sync: true`, it runs
immediately. This changes call handling, not ordinary input-change scheduling.
A pure function in an input-driven mode can skip a repeated synchronous call
when no input change is pending.

`null`, `undefined`, `false`, and `WAIT` do not trigger calls. Ordinary `Event`
instances trigger only in the resolver loop in which they were created.
Specialized events can override that behavior.

## `#custom` and `#optional`

`#custom` is an array of property descriptors defining additional properties.
`#optional` is an array of names selecting optional descriptor properties to
show in the editor. The [property API](../packages/core/property-api) maintains
these lists and their values.

## Runtime references

These properties are read-only references and should not be written into flow files:

- `#`: the current block.
- `##`: its parent.
- `#flow`: the containing flow.
- `#lib`: the flow owning the current function library, when available.
- `#name`: the block's name.
- `#+`: the current namespace root.

## Worker data and readiness

Workers receive inputs through `#inputs` and publish values through `#outputs`.
Within those blocks, `#input` and `#output` are conventional default property
names; named inputs and outputs are also supported.

`#wait` is true while work is pending. Clearing it lets a `WorkerFlow` report
readiness after resolution. Setting `#wait` on the worker's `#outputs` block
forwards readiness to the worker flow. `map`, `multi-worker`, and `handler`
use worker readiness when collecting results or reusing workers.

The `worker` function stores its source in `+use` and its running child flow at
`#worker`. `map`, `multi-worker`, and `handler` use `use` for their source.
See [worker architecture](../.agents/skills/ticlo/worker-architecture.md).
