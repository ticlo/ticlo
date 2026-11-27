# Live connectors

Live functions belong to the connector namespace. A connector supplies a
runtime service and can reuse the core `SubscribeFunction` for Block
subscriptions. Targets use adapter-specific types. The common events cover
initial snapshots, value updates, removals, messages, connection status, and
gaps. A Flow subscription follows its Block and continues independently of an
open inspector. A changing target replaces the old subscription.

A service can publish a `liveExplorer` and advertise the `live-client` tag
to offer **Manage live data**. The editor uses paged `listChildren` and
`search` operations when advertised by `describe()`. A result row has a
stable ID and may also have a branch reference, subscription target, or
cached preview. A row can have both a value and children. Cursors and
search fields are defined by the adapter.

The Tree and Search lists render a viewport. Tree automatically observes
visible values when supported. Search starts with a snapshot and offers live
previews when `watchRow` is available. The editor batches target changes
and caps each watch at 128 targets. Hiding or closing it releases the watch.
An adapter with `watchQuery` can also return a bounded ordered window whose
membership changes live. This mode requires an explicit action. Adapters
can instead expose a bounded sample or a live feed. The editor caps feed
history, and the transport reports when pending feed updates overflow.

UIs open live watches over the framed connection. Disconnecting the framed
connection or replacing the service releases its watches. Inspector writes,
such as publishing, go through separate commands and use the server's
readonly checks. Service credentials stay on the runtime host.

## MQTT

The development host imports `@ticlo/mqtt`. Other Node.js hosts can import
it to register these functions.

| Function | Use |
| --- | --- |
| `mqtt:client` | Connect to a broker and provide a service for the other MQTT Blocks. |
| `mqtt:subscribe` | Listen to a topic filter. The output is the latest decoded payload, with topic, QoS, retain, time and status fields. |
| `mqtt:query` | Call to page through topics the client has observed, optionally using a topic filter. |
| `mqtt:publish` | Call to send a payload to a topic, with optional QoS and retain settings. |

For `mqtt:client`, set `url` to an `mqtt://`, `mqtts://`, `ws://`, or
`wss://` broker URL. Set the optional client ID separately. Create an
embedded `auth:password` or `auth:oauth` Block in `auth`, or bind `auth` to the
output of a shared profile Block. For `auth:password`, set `username` and
`#secret` on the MQTT Block itself. For `auth:oauth` (see
[OAuth](oauth.md)), the client connects using the OAuth Bearer token in
`password` (with optional `username`) or, when `protocolVersion` is `5` and
`authMethod` is set, via MQTT 5 Enhanced Authentication (`CONNECT` properties).
`mqtt:client` forwards hidden `startAuthorization` and `oauthStatus` commands to
an embedded `~auth` Block, auto-connects after authorization, and refreshes
tokens proactively before expiration. An unset or `undefined` `auth` connects
without credentials, while an unready `auth:oauth` profile prevents `mqtt:client`
from running. `currentUser` OAuth is not supported for shared MQTT clients.

The protocol version is `4` for MQTT 3.1.1 or `5` for MQTT 5. The client uses
clean sessions and restores active subscriptions on reconnect. A gap event
indicates that messages may have been missed. TLS uses normal certificate
verification and accepts an optional PEM CA. The connector supports ordinary
MQTT topic filters and excludes shared subscription filters.

For mutual TLS over `mqtts://` or `wss://`, create a host-owned identity
with `createTlsClientIdentity(certPem, keyPem)` and expose it as the output of
a code-defined context Block. Bind MQTT's `tlsClientIdentity` to that output.
The PEM key stays on the host and the binding can be used alongside
`auth:password` or `auth:oauth` when the broker requires both.

Run `pnpm test connectors/mqtt` for the Aedes, Mosquitto, OAuth, and EMQX JWT
suites. Mosquitto and EMQX use temporary containers (Podman locally, or Docker
in GitHub Actions via `TICLO_TEST_MQTT_CONTAINER_ENGINE`).

The inspector's tree and search use a bounded, in-memory index of observed
topics. Open Search and enter a scoped filter to **Capture** for up to 3
seconds or 256 messages, or choose **Listen** to follow it until you leave the
feed. Then run Search again or refresh Tree to browse the observed topics.
Messages can arrive live or through broker retain. The index expires entries
after an hour and keeps at most 4,096 topics. It represents observations
made by this service instance.
