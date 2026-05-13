import {serve} from '@hono/node-server';
import {Hono} from 'hono';
import {Flow, Root, setStorageFunctionProvider} from '@ticlo/core';
import {FileFlowStorage, FileStorage} from '@ticlo/node';
import {connectTiclo, routeTiclo, getEditorUrl} from '@ticlo/web-server/server.js';
import '@ticlo/test';
import {data} from '../sample-data/data.js';
import reactData from '../sample-data/react.js';

(async () => {
  setStorageFunctionProvider(() => new FileStorage('./app/server/storage', '.str'));

  // create some global blocks
  Root.instance._globalRoot.createBlock('^gAdd').setValue('#is', 'add');
  Root.instance._globalRoot.createBlock('^gSub').setValue('#is', 'subtract');

  await Root.instance.setStorage(new FileFlowStorage('./app/server/flows'));

  if (!(Root.instance.getValue('example') instanceof Flow)) {
    console.log('initialize the database');
    const flow = Root.instance.addFlow('example', data);
  }

  const app = new Hono();

  app.use('*', async (c, next) => {
    if (c.req.header('upgrade') === 'websocket') {
      return next();
    }
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Headers', 'content-type');
    if (c.req.method === 'OPTIONS') {
      return c.body(null);
    }
    await next();
  });

  // Register Ticlo routes
  const ticloWs = await connectTiclo(app, '/ticlo');
  await routeTiclo(app, '/api');

  // Root route
  app.get('/', (c) => c.text(''));

  try {
    const server = serve({fetch: app.fetch, port: 8010, hostname: '0.0.0.0'});
    ticloWs.injectWebSocket(server);
    server.on('listening', () => {
      console.log('Server listening on http://localhost:8010');
      console.log(getEditorUrl('ws://127.0.0.1:8010/ticlo', 'example'));
      console.log('http://localhost:5173/editor.html?host=ws://127.0.0.1:8010/ticlo&flow=example');
    });
    server.on('error', (err) => {
      console.error(err);
      process.exit(1);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
