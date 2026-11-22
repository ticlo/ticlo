# OAuth for HTTP clients

Set the `auth` property of an `http:client` to an embedded `auth:oauth` Block or
bind it to a shared OAuth Block's `#output`. Bind `http:fetch.client` to that HTTP
client. A configured client binding must resolve before the fetch can send a request.
An explicit OAuth binding that is waiting for authorization yields an
`authorization-required` error when called.

The HTTP client attaches a Bearer token when a request is sent. The request
URL must match both the client's base URL origin and path boundary and the
OAuth registration's resource origin. OAuth requests reject redirects and
caller-supplied Authorization headers.

## Browser runtime

Select **browser** as the source. The default **generic** provider uses
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

## Deployment connection

Configure `oauth` in `createTicloApp` or `createServerApp` with the public host
origin, named OAuth registrations, a grant store and an `authorize` callback.
Register `/oauth/callback/<connection>` at that origin with the provider.
`authorize` checks the operator's permission to manage that connection and
returns the authenticated session ID. Use
`createFileOAuthGrantStore(directory, cipher)` for an encrypted store in a
directory outside the host's flow and file-server scopes. Keep the cipher key
across host restarts.

On the service-side Block, select **connection** and set the connection name
and required scopes. The host calls the Block's `connectOAuth` command to
obtain an authorization URL. Its `oauthStatus` command reads whether the
host has a usable grant. Deployed flows use the saved connection independently
of the operator's browser.

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
authorization, refresh and per-request grants with a local OAuth provider.
`pnpm test-oauth-browser` runs the popup, callback and a cross-origin HTTP call
in Chromium with browser security enabled.
