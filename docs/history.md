# History (Trending)

## Purpose

The history service (`/services/history`) records point values over time on the controller. Users can use this data to:
- see trends,
- troubleshoot,
- analyse building behaviour.

The service also stores other time-based data:
- histories supplied by other services, such as protocol integrations,
- the security audit log,
- alarm records (through the same storage engine).

## Core concepts

### Histories
A **history** is a time-series log tied to a source point. Each history has:
- an enabled/disabled switch,
- a value type: boolean, numeric types, enum, string or bytes,
- a **policy** that controls its size,
- record counts for current records and all records ever logged,
- a clear-records action.

Each **record** holds a timestamp, the value and status flags.

### Groups
Histories are organised in groups:
- **native**: histories created by users on the controller.
- **Provider groups**: histories supplied by other services, such as protocol integrations or the audit log. These can define extra columns, such as actor and operation for audit entries.

### Policies (retention)
A policy sets:
- the **maximum number of records**, 500 by default,
- what happens when the history is full:
  - **rolling**: the oldest records are overwritten,
  - **stop when full**.

Many histories can share one policy. Policies supplied by other services are read-only.

### Status flags
Every record keeps the quality of the value when it was logged:
- **Good**: including *override*.
- **Uncertain**: *null*, *stale*.
- **Bad**: *fault*, *down*, *disabled*, *unknown*.

Records also carry markers:
- **start**: logging resumed, so charts show a gap,
- **modified**,
- **hidden**,
- **schema change**,
- **security relevant**.

## Recording triggers

Native histories decide when to log a value through **triggers**. A history can have more than one.

| Trigger | Behaviour |
|---|---|
| **On change (COV)** | Logs when the value changes. Options: a **deadband** (minimum change), a **minimum time** between samples to limit fast-changing points, and a **maximum time** that logs a heartbeat sample even if nothing changed. |
| **Interval** | Logs on a schedule set by a cron expression, such as every 15 minutes or on the hour. |

## Retrieving data

### Trend query
This query is available on the service, on each history, and directly on any point that has a history. Options:
- **Time range**: open start or end is allowed.
- **Interval**:
  - automatic, raw, or a fixed bucket size, for example `15m`, `1h` or `1d`.
  - A unit can be aligned to calendar boundaries. For example, `15M` aligns to the hour and `1D` to the start of the day.
- **Rollup**: how values in a bucket are combined. Options: avg, min, max, sum, count, first, last, and, or.
  - Bad-quality values are left out when good values are available.
- **Delta**: returns the difference between values, which is useful for meters and totalizers.
- **Limit** on the number of results.

### Table query
- Returns raw records with all columns.
- Can filter on a column value, which is useful for the audit log.

## Audit log

- Security and configuration events are recorded as a history, with these columns:
  - actor, source, operation, target, old value, details.
- Events include logins, logouts, password resets and changes.
- The audit log can be exported as CSV.

## Provided histories

Other services, such as protocol integrations, can store their own logs in the history service. Their data then appears next to native histories and can be queried in the same way. They can also:
- supply their own size policies,
- add extra columns,
- read records back to serve their own clients.

## Storage and reliability

- Data is stored in an on-device time-series database built for embedded use. It recovers files after power loss or a crash.
- Older storage formats are converted automatically on upgrade.
- Storage use is reported in platform storage monitoring under *trends*.
- Enabling histories may be subject to licensing.

## Not included

- No general CSV export of point histories; only the audit log can be exported.
- No automatic logging of alarm changes into point histories.
- No alarm-triggered recording.
