# Ticlo overview

This document describes Ticlo's intended architecture and behavior. Use it as
the source of truth when rewriting or porting Ticlo, implementing some of its
features in another project, or borrowing its ideas. Other Ticlo documentation
and the current implementation may provide context, but when they conflict
with this overview, follow the overview.

Ticlo is a visual dataflow engine. A flow is a graph of blocks connected
by wires. Events carry values through that graph. The main design goals are
predictable execution and low memory use: values exist only while they are in
flight or while a block explicitly retains them.

## Core concepts

- **Function type:** A registered definition of a block's input ports, output
  ports, configuration, behavior, and lifecycle. Sources produce events,
  transforms and filters process them, and sinks consume them. A function type
  can also define explicit stateful behavior, such as holding the latest value
  or combining several inputs.
- **Block:** One instance of a function type in a flow. It has an identity,
  configuration, position, and any state declared by that type. The function
  type is fixed when the block is created. A block is a function instance, not
  a generic container for a swappable function. Changing behavior means
  replacing the block and reconnecting its wires deliberately.
- **Port:** A named input or output belonging to a function type. Port identities
  remain stable so wires can refer to them even when their display names change.
- **Wire:** A directed connection from one output port to one input port. It
  carries deliveries but does not retain their values. Several wires may listen
  to one output.
- **Binding listener:** The runtime connection that receives an output emission
  and schedules delivery through its wire. Listeners are active only while their
  wires are connected.
- **Event:** One delivery of a value to an input port. Events may cause a block
  to emit more events. Configuration and explicitly retained block state are
  separate from event values.

## Block lifecycle

A function type defines what happens when its block is created, receives an
input, and is removed. Initialization may establish resources or emit a source
event. Input handling may emit zero or more output events. Removal cancels
pending work, detaches listeners, and releases resources and state. Asynchronous
work belongs to the block that started it and must not emit after that block is
removed.

Blocks do not get implicit "latest input" or "latest output" storage. A block
that needs a previous value must declare and manage that state explicitly. This
keeps retention visible in the function type's contract and lets a flow author
choose where memory is spent. A function type may define how its explicit state
is reset or persisted; transient event values are never persisted by default.

## Value delivery and memory

When a block emits a value, its output calls the connected binding listeners.
The output does **not** store the value. Once the listeners have accepted the
delivery, the block and output release their references to it. A listener or
scheduler may hold the value only until its queued delivery is handled.

An input holds its value only while the receiving block uses it. After handling
finishes, the input deletes its reference. Asynchronous handlers may retain a
value only for the lifetime of that operation and must release it on completion
or cancellation. If a block needs the value later, it must copy or transfer it
into explicit block state. Fan-out deliveries treat a shared value as immutable;
a block that needs to mutate it must make its own copy.

Queues must have a defined bound or backpressure rule so a fast producer cannot
create unbounded retained events. Diagnostics, undo history, and debugging tools
must not quietly retain event payloads. The intended memory footprint is the
current in-flight work plus explicitly retained state, rather than the history
of values that passed through the graph.

## Wire order and routing

Every wire stores its own ID, source and destination ports, an execution order,
and an ordered list of route points between its endpoints. Route points are
middle nodes that users can drag to organize the wire's path. They are layout
metadata, not processing blocks, and survive saving and loading the flow.

For one output emission, deliver its wires in their visible order: top before
bottom, then left before right. Compare each wire's first route point after the
source, or its destination port if it has no route point. The editor records
that order in the wires' metadata and updates it when those positions change.
The runtime uses the recorded order, with wire ID as a final tie-breaker; it
never relies on object iteration order, listener registration order, or timing.
Moving a route point changes execution order only if it changes this ordering
position.

The scheduler processes deliveries serially. Emissions produced while handling
one delivery join the end of the current queue. Events admitted together from
independent sources use the sources' visible top-to-bottom, then left-to-right
order, with block ID as a tie-breaker. A given flow and sequence of admitted
events must therefore produce the same execution trace on every run.

## Flow data and editing

The runtime owns the graph, scheduling, and value lifetimes. The editor owns
layout and graph-editing commands, while host adapters supply external input
and output. These parts communicate through explicit graph and event contracts
so the engine can be implemented without a particular UI or host language.

A saved flow records its format version, block IDs, fixed function type IDs,
configuration, block positions, and wires with endpoint IDs, execution order,
and route points. It does not save transient input values, output values, or
queued events. A type or format change that needs migration must be explicit;
loading must not silently turn an existing block into a different function type.

Editing the graph updates connections and listeners together. Removing a wire
stops future deliveries through it and releases its pending work according to
the scheduler's cancellation rule. Removing a block disconnects its wires and
runs its cleanup. Undo and redo restore graph structure and metadata, including
wire order and route points, without resurrecting transient event values.

## Implementation checks

An implementation should demonstrate the applicable contracts with
representative flows:

- Repeated large values pass through a chain and fan-out without accumulating
  output or consumed input references.
- Stateful behavior retains values only in blocks that explicitly request it,
  and cleanup releases those values.
- Simultaneous events and fan-out follow the same visible wire order on repeated
  runs and after save/load.
- Dragged middle nodes persist, and changing wire geometry preserves or updates
  execution order according to the visible order rule.
- A block's function type cannot change in place; replacement and undo/redo
  preserve the intended connections and metadata.
