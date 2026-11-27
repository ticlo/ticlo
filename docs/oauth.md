# OAuth for HTTP and MQTT clients

Set the `auth` property of an `http:client` or `mqtt:client` to an embedded `auth:oauth` Block or
bind it to a shared OAuth Block's `#output`. Bind `http:fetch.client` to an HTTP
client, or MQTT Blocks' `client` property to an MQTT client. `auth:oauth` runs at
priority `0`, while client Blocks run at priority `1` or higher. While an OAuth
Block is unready (for example, missing configuration or `#secret`), it outputs an
unready profile and the client Block refuses to run instead of connecting
anonymously. An unbound or `undefined` `auth` property connects without OAuth.

An explicit OAuth binding that is waiting for user consent yields an
`authorization-required` error when called. Client Blocks with an embedded `~auth`
Block forward the hidden `startAuthorization` and `oauthStatus` commands to it so
`@b-widget: 'web-authorization'` can be placed directly on the client Block.

`resourceOrigin` accepts `https:`, `wss:`, and `mqtts:` origins, or loopback
(`localhost`, `127.0.0.1`, `[::1]`) `http:`, `ws:`, and `mqtt:` origins.
`http:client` attaches a Bearer token whose target matches both the client's base
URL origin and path boundary and the OAuth registration's `resourceOrigin`, and
rejects redirects and caller-supplied `Authorization` headers. Long-lived
connectors such as `mqtt:client` observe status changes to auto-connect after
authorization, refresh proactively before `expiresAt`, and force a single refresh
on authorization rejection.

Each runtime registers OAuth explicitly before loading Flows. Use
`registerOAuth()` from `@ticlo/oauth/browser` or `@ticlo/oauth/node`.
Both entries provide `auth:oauth` with properties appropriate to their runtime.

## Browser runtime

The default **generic** provider uses
Authorization Code with PKCE. Set `clientId`, `authorizationUrl`,
`tokenUrl`, `resourceOrigin` and `scope`. Register a public client. Its redirect
URI is `oauth-callback.html` next to the runtime page, with the `provider` query
parameter set to the encoded issuer. The default issuer is the authorization
URL's origin. Set `issuer` for providers that use a different issuer URL. The
provider token endpoint and protected API must accept CORS requests from the
runtime page's origin.

A host can also call the generic provider’s `connectOAuth` command to obtain the
authorization URL and observe the Block’s `status`. Grants stay in browser memory.

Select the **google** provider to use the Google Identity Services popup.
Set `clientId` and `scope` for your Google app, then set `resourceOrigin` to
`https://www.googleapis.com`.
Register the runtime's JavaScript origin on the Google Web OAuth client. Set
`appOrigin` if the flow should only authorize on that origin. The Block
prepares the Google SDK when this provider is selected.

Expose `onClick` on a regular `react:button` and bind it to the browser OAuth
Block's `#call`. The Block starts the authorization during the click, while the
browser allows it to open a window. After the Google SDK finishes loading,
the Block reports `authorization-required` and is ready for the click.

The browser Block emits `authorized` after accepting a grant. Bind
`http:fetch.#call` to it to make a request after approval. Google browser
grants expire in memory and require another click to authorize again.
The **examples → oauth → google-drive** flow shows these bindings. Switch to
**Preview**, then click **Connect Google Drive**.

## Node.js runtime

The development server provides the OAuth callback routes by default. To embed
the connector in your own HTTP host, use `registerOAuth` and `routeOAuth` from
`@ticlo/oauth/node`. The Hono integration provides the callback routes and the
Flow can define the provider and credentials when the Block is loaded or edited.
Use `createFileOAuthGrantStore(directory, cipher)` for an encrypted
store outside all flow and file-server scopes. Keep the cipher key across
restarts. The host's `authorize` callback checks the operator's permission and
returns the authenticated session ID for the confirmation and callback.

Set `grantType` to `authorization_code` (default) for interactive consent, or
`client_credentials` for headless machine-to-machine tokens using `tokenUrl`,
`clientId`, `#secret`, `resourceOrigin`, and `scope` (which also works on a
`server` Block without `routeOAuth` when no HTTP host is mounted).

The default **server** source takes `connection`, `clientId`,
`authorizationUrl`, `tokenUrl`, `resourceOrigin` and `scope` from the Block.
Set `allowFlowClients: true` on a host that trusts its Flow authors. Enter the
Client Secret in the Block's write-only [`#secret` field](runtime-lifecycle.md#block-secrets).
Enable `requireClientSecret` if the provider requires a secret. Register
`/oauth/callback/<connection>` at the host's public origin with the provider.

Use **connection** as the source to select a deployment registration from the
host's `connections` option by name. Add the [web authorization widget](block-widgets.md#web-authorization)
to call `startAuthorization` and open the authorization popup. Triggering `#call`
also publishes a short-lived `authorizationLink`. The host receives the
provider's callback, saves the grant, and dispatches the internal
`completeAuthorization` command to the originating Block. The Block emits
`authorized` on success.
An existing usable grant also emits `authorized` when the Block loads.

### Node.js Google Drive example

1. In Google Auth Platform, add `http://127.0.0.1:8010/oauth/callback/google-drive`
   to the authorized redirect URIs for the Web application Client ID
   `218591242507-jg4hjrjdp9mi1vkmgeu3hvrfkvam9dii.apps.googleusercontent.com`.
   Enable the Drive API and add your account as a test user if the app is in
   Testing. See [Google's web server OAuth setup](https://developers.google.com/identity/protocols/oauth2/web-server).
2. Run `pnpm dev` and open **Examples → oauth → google-drive** in the local Editor.
3. Select `googleDriveAuth`. Paste the matching Google Client Secret into
   `#secret` in the Properties panel, press Enter, and save the Flow.
4. Click **Connect Google Drive** and complete authorization in the Google popup.
   After consent, `getDriveUser.#output` displays the Drive account's name and email.

The development host binds to loopback and stores encrypted grants under
`app/server/files/.oauth-grants`. It creates a browser session when the
authorization popup opens, redirects to the provider, and checks that session
on callback. Embedded hosts can set `confirmAuthorization: false` to redirect
directly after validating the start ticket and the operator session.

## Signed-in user

Select **currentUser** to use an existing grant for the current Ticlo user.
Bind `http:fetch.authContext` to the route’s `authContext` input. The host’s
`oauth.userGrant` hook receives the incoming Hono context, connection and scopes.
It returns a valid grant for the authenticated user, refreshing it when needed.
The request handle expires when the response completes, even when users share
an `http:client`. A missing or insufficient grant yields `authorization-required`.
The page host owns login and any additional consent for the signed-in user.

## Testing

`pnpm test packages/web-server/__spec__/OAuth.spec.ts` exercises deployment
authorization, refresh, `client_credentials`, embedded command forwarding, and
per-request grants with a local OAuth provider.
`pnpm test connectors/mqtt/__spec__/MqttOAuth.node.test.ts` exercises MQTT
OAuth auto-connect, proactive rotation, revocation recovery, `client_credentials`,
and MQTT 5 Enhanced Authentication.
`pnpm test-oauth-browser` runs the popup, callback and a cross-origin HTTP call
in Chromium with browser security enabled.
