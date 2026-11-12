# Ticlo overview

This document is the normative target for Ticlo's architecture and behavior;
it does not claim that the current implementation already follows it. Anyone
rewriting or porting Ticlo, implementing its features in another project, or
borrowing its ideas MUST use this document as the source of truth. Other Ticlo
documentation and the current code may provide context, but their conflicting
behavior MUST NOT be copied into a new implementation. `REFACTOR(design.md)`
comments in `packages/core` mark required changes at legacy code locations, not
behavior that the current code already guarantees. MUST and MUST NOT in this
document and those comments state requirements for the target implementation.

Ticlo is a visual dataflow engine. A flow is a graph of blocks connected
by wires, and events carry values through it. Runtime performance is the
primary design constraint. Keep dispatch, allocations, and memory proportional
to active work. A value lives only for the part of an operation that needs it
or in explicitly declared state.

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
work belongs to the block that started it. Disablement, replacement, removal,
and runtime shutdown invalidate completions for the affected operation. Cancel
or drain the underlying work and release its inputs and results. A database
client block owns the pool or worker, and each query or transaction owns its
request resources. Run a transaction on one connection and roll back uncommitted
changes on failure. Committed writes survive suppression of a stale completion.

The host installs read-only global configuration and service handles before
loading saved flows. Saved global data can extend fields that the host leaves
unclaimed. Host-owned fields keep their identity and values across reloads
and runtime stop/start. Runtime shutdown detaches consumers and releases
runtime-owned work. The host controls the lifetime of its services.

Resolve credentials as protected configuration for the owning function.
Use the host's authenticated codec when persisting credentials. Keep credential
contents out of ordinary value inspection and diagnostics, including when they
come from an environment lookup.

Retain the smallest value that future work needs. The function type declares
its state, capacity, release conditions, and any persistence rules. Input and
output ports carry transient values and release their references at the last use.

## Value delivery and memory

On emission, hand the value to connected listeners and release the output
reference. Skip delivery and observer work when there are no recipients.
Fan-out shares an immutable value. A receiving block copies only the parts
it needs to mutate. Use graph indexes maintained on edits so the delivery
path can visit only the affected wires and inputs. Keep graph serialization,
whole-value copies, and deep comparisons off the generic delivery path.

An input releases its reference as soon as the handler no longer needs it,
even if the operation continues asynchronously. Release queued and in-flight
references when their work finishes or is canceled. Queues bound pending
work and retained payload volume through admission limits or backpressure.
Diagnostics and undo history store the metadata they need. The memory
footprint should track active work and declared state as delivery volume grows.

Derive wait status from owned work. Produce bounded error summaries on demand
for observers or declared diagnostic state. Release the original error payload
after delivery. An error delivered to a flow follows normal event lifetime.

Snapshot subscriptions read configuration or declared state on demand. Event
observers receive new deliveries. Apply message and value budgets independently.
Page directly from retained values, validate continuation against the current
data, and materialize only the requested range. Release inspector read buffers
when the request finishes and observer caches when the last consumer detaches.

Management commands are policy-checked invocations. Their named results belong
to the request. An editor view retains only the result data it needs for display
and releases it on replacement or close.

## Wire order and routing

Every wire stores its own ID, source and destination ports, an execution order,
and an ordered list of route points between its endpoints. Route points are
middle nodes that users can drag to organize the wire's path. They are layout
metadata, not processing blocks, and survive saving and loading the flow.

For one output emission, deliver its wires in their visible order: top before
bottom, then left before right. Compare each wire's first route point after the
source, or its destination port if it has no route point. The editor records
that order in the wires' metadata and updates it when those positions change.
The runtime maintains traversal order when the graph changes and uses the
recorded order at delivery time, with wire ID as the final tie-breaker.
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
The editor chooses the initial view from the loaded graph and its declared page
entry. View labels and paths are presentation metadata. Editor commands target
stable graph identities, and each view owns its selection.

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

An implementation MUST demonstrate the applicable contracts with
representative flows:

- Measure delivery latency, allocations, and peak memory with repeated large
  values through chains and fan-out. After draining or canceling work, check that
  only declared state remains reachable.
- Stateful behavior retains values only in blocks that explicitly request it,
  and cleanup releases those values.
- Restarting the runtime preserves host declarations and detaches their old
  consumers. A canceled database request cannot publish a late result.
- Reconnecting or paging can inspect retained state without replaying events,
  and error status remains available without retaining the failed delivery.
- Simultaneous events and fan-out follow the same visible wire order on repeated
  runs and after save/load.
- Dragged middle nodes persist, and changing wire geometry preserves or updates
  execution order according to the visible order rule.
- A block's function type cannot change in place; replacement and undo/redo
  preserve the intended connections and metadata.
