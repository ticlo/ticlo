import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {expect, it} from 'vitest';
import {chromium, type Page} from 'playwright';
import {createServer} from 'vite';
import {serve} from '@hono/node-server';
import {Hono} from 'hono';
import {getCookie} from 'hono/cookie';
import {Root, setSecretCipher, type DataMap} from '@ticlo/core';
import {SecretCipher} from '@ticlo/node';
import {registerOAuth, routeOAuth, type OAuthGrant} from '@ticlo/oauth/node';
import type {HttpClient} from '@ticlo/core/functions/http/HttpClient.ts';
import {createTicloApp} from '../server.ts';
import {startOAuthProvider} from './OAuthProvider.ts';

const moduleUrl = (path: string) => `/@fs${fileURLToPath(new URL(path, import.meta.url))}`;
const optimizeDeps = {
  include: [
    'vite-plugin-node-polyfills/shims/buffer',
    'vite-plugin-node-polyfills/shims/global',
    'vite-plugin-node-polyfills/shims/process',
  ],
};

interface BrowserFlow {
  data: DataMap;
  authPath: string;
  fetchPath: string;
}

function createBrowserHost() {
  return createServer({
    cacheDir: '../node_modules/.vite-oauth-browser-test',
    optimizeDeps,
    server: {host: '127.0.0.1', port: 0, hmr: false, watch: null},
    plugins: [
      {
        name: 'oauth-browser-test',
        configureServer(server) {
          server.middlewares.use('/__oauth_test.html', async (req, res, next) => {
            if (req.url.includes('html-proxy')) return next();
            const html = await server.transformIndexHtml(
              '/__oauth_test.html',
              `<!doctype html>
          <button disabled>Authorize</button>
          <output id="status"></output><output id="result"></output>
          <script type="module">
          import {Event, Root} from '${moduleUrl('../../core/index.ts')}';
          import {registerOAuth} from '@ticlo/oauth/browser';
          registerOAuth();
          window.mountOAuthTest = ({data, authPath, fetchPath}) => {
            const root = new Root();
            const flow = root.addFlow('oauth', data);
            root.runAll();
            const auth = flow.queryValue(authPath);
            const result = document.querySelector('#result');
            const status = document.querySelector('#status');
            auth.getProperty('status').listen({onChange(value) { status.value = value; }});
            auth.getProperty('#output').listen({
              onChange(value) { document.body.dataset.authPreview = JSON.stringify(value); },
            });
            flow.queryProperty(fetchPath + '.#output', true).listen({
              onChange(value) { result.value = value ? JSON.stringify(value) : ''; },
            });
            const button = document.querySelector('button');
            button.disabled = false;
            button.onclick = () => auth.updateValue('#call', new Event('click'));
          };
          </script>`
            );
            res.setHeader('Content-Type', 'text/html');
            res.end(html);
          });
        },
      },
    ],
  });
}

async function mountBrowserFlow(page: Page, origin: string, flow: BrowserFlow) {
  await page.goto(`${origin}/__oauth_test.html`);
  await page.waitForFunction(() => 'mountOAuthTest' in window, null, {timeout: 20000});
  await page.evaluate(
    (flow) => (window as unknown as {mountOAuthTest(flow: BrowserFlow): void}).mountOAuthTest(flow),
    flow
  );
}

it('authorizes a browser flow with PKCE and fetches across origins', async () => {
  const provider = await startOAuthProvider();
  const vite = await createBrowserHost();
  let browser: Awaited<ReturnType<typeof chromium.launch>>;
  try {
    await vite.listen();
    const address = vite.httpServer.address();
    if (typeof address !== 'object' || !address) throw new Error('Missing browser test address');
    const origin = `http://127.0.0.1:${address.port}`;
    const redirect = new URL('/oauth-callback.html', origin);
    redirect.searchParams.set('provider', provider.origin);
    provider.clients.set('browser-client', {redirectUri: redirect.href});

    browser = await chromium.launch();
    const context = await browser.newContext();
    context.setDefaultTimeout(10000);
    const page = await context.newPage();
    await mountBrowserFlow(page, origin, {
      authPath: 'client.~auth',
      fetchPath: 'fetch',
      data: {
        client: {
          '#is': 'http:client',
          'url': provider.origin,
          '~auth': {
            '#is': 'auth:oauth',
            'authorizationUrl': provider.origin + '/authorize',
            'tokenUrl': provider.origin + '/token',
            'clientId': 'browser-client',
            'resourceOrigin': provider.origin,
            'scope': 'read',
          },
        },
        fetch: {
          '#is': 'http:fetch',
          '#mode': 'onCall',
          '~#call': '##.client.~auth.authorized',
          'url': '/resource',
          '~client': '##.client.#output',
        },
      },
    });
    const authorize = page.getByRole('button', {name: 'Authorize'});
    const abandoned = context.waitForEvent('page');
    await authorize.click();
    const first = await abandoned;
    await first.getByRole('button', {name: 'Allow'}).waitFor();
    await first.close();
    const popup = context.waitForEvent('page');
    await authorize.click();
    const authorization = await popup;
    await authorization.getByRole('button', {name: 'Allow'}).click();
    await authorization.waitForURL((url) => url.pathname === '/oauth-callback.html');
    await expect.poll(() => page.locator('#result').textContent()).toBe('{"user":"browser-client"}');

    const retry = context.waitForEvent('page');
    await authorize.click();
    await (await retry).getByRole('button', {name: 'Deny'}).click();
    await page.getByText('authorization-denied', {exact: true}).waitFor();
  } finally {
    await browser?.close();
    await Promise.all([vite.close(), provider.close()]);
  }
}, 60000);

it('starts Node OAuth from a Block widget and resumes the Flow after confirmation', async () => {
  const provider = await startOAuthProvider();
  const root = new Root();
  const app = new Hono();
  const vite = await createServer({
    cacheDir: '../node_modules/.vite-oauth-editor-test',
    optimizeDeps,
    server: {host: '127.0.0.1', port: 0, watch: null},
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>>;
  const server = serve({fetch: (request) => app.fetch(request), hostname: '127.0.0.1', port: 0});
  try {
    await once(server, 'listening');
    const address = server.address();
    if (typeof address !== 'object' || !address) throw new Error('Missing OAuth server address');
    const origin = `http://127.0.0.1:${address.port}`;
    provider.clients.set('node-client', {redirectUri: `${origin}/oauth/callback/team`, secret: 'test-secret'});
    const grants = new Map<string, OAuthGrant>();
    setSecretCipher(new SecretCipher(new Uint8Array(32)));
    registerOAuth();
    routeOAuth(app, root, {
      origin,
      allowFlowClients: true,
      confirmAuthorization: false,
      authorize: (c) => getCookie(c, 'test-session'),
      store: {
        async get(key) {
          return grants.get(key);
        },
        async set(key, grant) {
          grants.set(key, grant);
        },
      },
    });
    const host = await createTicloApp({app, root, enableEditor: true});
    host.ticloWs.injectWebSocket(server);
    const flow = root.addFlow('oauth', {
      auth: {
        '#is': 'auth:oauth',
        'connection': 'team',
        'clientId': 'node-client',
        'requireClientSecret': true,
        'scope': 'read',
        'resourceOrigin': provider.origin,
        'authorizationUrl': `${provider.origin}/authorize`,
        'tokenUrl': `${provider.origin}/token`,
        '@b-xyw': [48, 104, 258],
        '@b-widget': 'web-authorization',
      },
      fetch: {
        '#is': 'http:fetch',
        '#mode': 'onCall',
        '~#call': '##.auth.authorized',
        '~client': '##.client.#output',
        'url': '/resource',
      },
      client: {'#is': 'http:client', 'url': provider.origin, '~auth': '##.auth.#output'},
    });
    root.runAll();
    await vite.listen();
    const editorAddress = vite.httpServer.address();
    if (typeof editorAddress !== 'object' || !editorAddress) throw new Error('Missing Editor address');
    const editorUrl = new URL('/editor.html', `http://127.0.0.1:${editorAddress.port}`);
    editorUrl.searchParams.set('host', `${origin}/ticlo`);
    editorUrl.searchParams.set('flow', 'oauth');
    browser = await chromium.launch();
    const context = await browser.newContext();
    await context.addCookies([{name: 'test-session', value: 'operator', url: origin, sameSite: 'Lax'}]);
    const editor = await context.newPage();
    await editor.goto(editorUrl.href);
    await editor
      .locator('.ticl-e-block-head-label')
      .filter({hasText: /^auth$/})
      .click();
    const secret = editor.locator('.ticl-e-property-list input[type="password"]');
    const authorize = async () => {
      const [page] = await Promise.all([
        context.waitForEvent('page', {timeout: 10000}),
        editor.locator('.ticl-e-button-view button').click({timeout: 10000}),
      ]);
      await page.getByRole('button', {name: 'Allow'}).click();
      return page;
    };
    await secret.fill('wrong-secret');
    await secret.press('Enter');
    await expect.poll(() => flow.queryValue('auth.status')).toBe('authorization-required');
    const rejected = await authorize();
    await rejected.getByText('The OAuth provider rejected the Client ID or Client Secret.', {exact: false}).waitFor();
    await rejected.close();
    expect(flow.queryValue('auth.status')).toBe('authorization-failed');

    await secret.fill('test-secret');
    await secret.press('Enter');
    await expect.poll(() => flow.queryValue('auth.status')).toBe('authorization-required');
    expect(flow.queryValue('auth.#secret')).toBeUndefined();
    expect(flow.save().auth).toHaveProperty('#secret', expect.any(Uint8Array));
    console.log(await editor.locator('.ticl-e-button-view button').evaluate((button) => button.outerHTML));
    const page = await authorize();
    await page.getByText('Authorization saved.', {exact: false}).waitFor();
    const client = flow.queryValue('client.#output') as HttpClient;
    expect((await client.request({url: '/resource'})).data).toEqual({user: 'node-client'});
    expect(flow.queryValue('auth.status')).toBe('authorized');
    expect(flow.queryValue('auth.authorizationLink')).toBeUndefined();
    await expect.poll(() => flow.queryValue('fetch.#output')).toEqual({user: 'node-client'});
    expect(JSON.stringify(flow.save())).not.toContain('test-secret');
  } finally {
    await browser?.close();
    root.destroy();
    setSecretCipher(undefined);
    await Promise.all([
      vite.close(),
      provider.close(),
      new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
    ]);
  }
}, 60000);

it('authorizes and calls Google Drive when the Designer example button is clicked', async () => {
  const vite = await createServer({
    cacheDir: '../node_modules/.vite-oauth-designer-test',
    optimizeDeps,
    server: {host: '127.0.0.1', port: 0, watch: null},
  });
  let browser: Awaited<ReturnType<typeof chromium.launch>>;
  try {
    await vite.listen();
    const address = vite.httpServer.address();
    if (typeof address !== 'object' || !address) throw new Error('Missing browser test address');
    const origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch();
    const context = await browser.newContext();
    context.setDefaultTimeout(10000);
    await context.route('https://unpkg.com/**', (route) => route.abort());
    await context.route(`${origin}/storage/proj/examples/oauth/google-drive.ticlo`, async (route) => {
      const response = await route.fetch();
      const flow = await response.json();
      flow.googleDriveAuth.appOrigin = origin;
      await route.fulfill({response, json: flow});
    });
    await context.route('https://accounts.google.com/gsi/client', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: `window.google = {accounts: {oauth2: {
        initTokenClient(config) {
          return {requestAccessToken() {
            if (!navigator.userActivation.isActive) throw new Error('Missing click activation');
            if (window.testGoogleResult === 'closed') config.error_callback({type: 'popup_closed'});
            else if (window.testGoogleResult === 'denied') config.callback({error: 'access_denied'});
            else config.callback({access_token: 'test-google-token', expires_in: '3600', scope: config.scope});
          }};
        }
      }}};`,
      })
    );
    const requests: [string, string, string][] = [];
    await context.route(
      (url) => url.origin === 'https://www.googleapis.com',
      async (route) => {
        const headers = {
          'access-control-allow-origin': origin,
          'access-control-allow-methods': 'GET',
          'access-control-allow-headers': 'Authorization',
        };
        if (route.request().method() === 'OPTIONS') {
          await route.fulfill({status: 204, headers});
          return;
        }
        const url = new URL(route.request().url());
        requests.push([
          url.pathname,
          url.searchParams.get('fields'),
          (await route.request().allHeaders()).authorization,
        ]);
        await route.fulfill({
          headers,
          json: {user: {displayName: 'Drive test user', emailAddress: 'user@example.test'}},
        });
      }
    );
    const page = await context.newPage();
    await page.goto(`${origin}/designer.html?path=examples/oauth/google-drive`);
    await page.getByText('authorization-required', {exact: true}).waitFor({timeout: 20000});
    await page.getByRole('switch', {name: 'Design'}).click();
    const connect = page.getByRole('button', {name: 'Connect Google Drive'});
    for (const [result, status] of [
      ['denied', 'authorization-denied'],
      ['closed', 'authorization-cancelled'],
    ]) {
      await page.evaluate((result) => {
        Object.assign(window, {testGoogleResult: result});
      }, result);
      await connect.click();
      await page.getByText(status, {exact: true}).waitFor();
      expect(requests).toHaveLength(0);
    }
    await page.evaluate(() => {
      Object.assign(window, {testGoogleResult: 'allowed'});
    });
    await connect.click();
    await page.getByText('Drive test user', {exact: true}).waitFor();
    await page.getByText('user@example.test', {exact: true}).waitFor();
    expect(requests).toEqual([['/drive/v3/about', 'user(displayName,emailAddress)', 'Bearer test-google-token']]);
    await page.addScriptTag({
      type: 'module',
      content: `import {Root} from '${moduleUrl('../../core/index.ts')}';
        const profile = Root.instance.queryValue('+examples.oauth.google-drive.googleDriveAuth.#output');
        document.body.dataset.authPreview = JSON.stringify(profile);`,
    });
    await expect.poll(() => page.locator('body').getAttribute('data-auth-preview')).toBe('"\\b:auth:oauth"');
  } finally {
    await browser?.close();
    await vite.close();
  }
}, 60000);
