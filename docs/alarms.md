# Alarms

## Purpose

The alarm service (`/services/alarms`) is the controller's central place for alarm and event information. It does four things:

- **Detects** abnormal conditions on local points.
- **Collects** alarms from other sources, such as field protocols, remote devices or any service that raises one.
- **Tracks** each alarm's life cycle from occurrence through acknowledgement to return-to-normal.
- **Notifies** the right people or systems when something happens.

## Core concepts

### Alarm states
A monitored source is always in one of three states:

| State | Meaning |
|---|---|
| **Normal** | Operating as expected |
| **Offnormal** | An alarm condition exists, such as out of range or an unexpected state |
| **Fault** | The source is unreliable, such as a sensor fault, a device that is down or an invalid value |

Each change from one state to another is stored as an **alarm record**.

### Alarm records
A record holds:
- When the change happened, the source and the alarm class.
- The previous and new states.
- A priority from 0 (highest) to 255 (lowest).
- A readable message and optional structured data.
- Acknowledgement information: whether an ack is required, the ack state, who acknowledged it and when.

### Acknowledgement
Some transitions must be acknowledged by an operator. A record is in one of three ack states:
- **Unacked**
- **Ack pending**: a user acknowledged it, and the system is waiting for the origin to confirm, such as a remote device.
- **Acked**

Operators can acknowledge:
- individual records,
- everything at once,
- everything in one alarm class,
- everything for a given source.

If an alarm came from another system, the ack is sent back to that system. If the origin rejects the ack, the record goes back to unacked. Acks made elsewhere, for example by another workstation, are also applied here.

### Active vs. inactive
A record is **active** when it is the latest transition of that type for its source. Views can show:
- only active alarms,
- active and unacknowledged alarms,
- inactive but still unacknowledged alarms.

## Alarm classes

An alarm class groups alarms that share behaviour and recipients. For each state (Fault, Offnormal, Normal), a class sets:
- whether an acknowledgement is required,
- the priority.

There are three kinds of class:
- **Native classes**: created by users on the controller.
- **Provided classes**: supplied by other services, such as a protocol integration. They appear here automatically and stay in sync with their origin.
- **Fallback classes**: catch alarms from a provider that don't name a class.

If a provider goes offline, its classes' settings are kept until it returns.

## Local alarm detection

Users create **alarm configurations** to watch any point on the controller. Each configuration points to a source element and holds one or more detection **algorithms**:

| Algorithm | Detects |
|---|---|
| **Numeric out of range** | The value goes above a high limit or below a low limit. A deadband prevents chatter. Each limit can be set to raise either Offnormal or Fault. |
| **Boolean state** | The value equals a chosen alarm value. |
| **Enum state** | The value is in a list of offnormal values or a list of fault values. |
| **Status state** | The point's status shows it is down or in fault. |

Every algorithm also supports:
- **Target class**: which alarm class receives the alarms.
- **Custom messages** for the alarm and return-to-normal transitions.
- **Time delays**: a condition must last a set time before it goes into alarm, or before it returns to normal. This filters out short glitches.
- **Inhibit**: a boolean point that suppresses detection while it is true.
- **Enable/disable**, and a status showing whether the source was resolved.
- **State persistence**, so alarm state survives a restart.

## Notifications (recipients)

Each alarm class has a list of **recipients**, such as email or other recipient types from the platform's recipient framework. For each recipient you can set:
- **Schedule**: the days of the week and a time window (which can cross midnight) when it gets notifications.
- **Which events to send**: fault, offnormal, return-to-normal and acknowledgement can each be turned on or off. By default only fault and offnormal are on.
- **Message templates** with placeholders: message, timestamp, class, from/to state, priority, ack info and data.

The result of the last delivery to each recipient (success or failure) is shown for troubleshooting.

> There is no escalation, shelving or repeated-notification feature.

## Viewing and managing alarms

- **Alarm table**: query by time range, class or source. You can limit it to active alarms and choose whether hidden records appear.
- **Live alarm stream**: a live feed of new and updated alarms, using the same filters.
- **Hide / clear records**: removes records from normal views.
- **Raise alarm manually**: an action on any class adds an alarm with a source, states, message and data.
- **Status flags**: points that have alarms show *alarm* and *unacknowledged alarm* status flags.

## Storage

- Records are stored on the controller in its time-series database, up to about 100,000 records. When the database is full, the oldest records are rolled over.
- Storage use is reported in platform storage monitoring under *alarms*.

## Integrations

- **Protocol integrations**: other services can plug into the alarm service. They can:
  - supply their own alarm classes,
  - send alarms from remote devices,
  - confirm acknowledgements with the device the alarm came from.
- **Cloud / facilities**: alarms are forwarded upstream. The connection resumes where it left off after an interruption. Acks and clears can come from the cloud.
- **ECX display**: on-device screens list active-unacked, active-acked and inactive-unacked alarms, with details and acknowledgement.
- **REST / DSA**: alarms, classes, configurations and actions are available through the standard element tree.
