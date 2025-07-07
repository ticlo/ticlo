import Fastify from 'fastify';
import {Flow, Root, setStorageFunctionProvider} from '@ticlo/core';
import {FileFlowStorage, FileStorage} from '@ticlo/node';
import {connectTiclo, routeTiclo, getEditorUrl} from '@ticlo/web-server/server';
import '@ticlo/test';
import {data} from '../sample-data/data';
import reactData from '../sample-data/react';
import * as fs from 'fs';
import * as path from 'path';

(async () => {
  setStorageFunctionProvider(() => new FileStorage('./app/server/storage', '.str'));

  // create some global blocks
  Root.instance._globalRoot.createBlock('^gAdd').setValue('#is', 'add');
  Root.instance._globalRoot.createBlock('^gSub').setValue('#is', 'subtract');

  await Root.instance.setStorage(new FileFlowStorage('./app/server/flows'));

  if (!(Root.instance.getValue('example') instanceof Flow)) {
    console.log('initialize the database');
    let flow = Root.instance.addFlow('example', data);
  }

  // Create Fastify instance with HTTP support
  const app = Fastify({
    logger: true,
  });

  // HTTP/2 configuration example (commented out):
  // const app = Fastify({
  //   http2: true,
  //   https: {
  //     allowHTTP1: true, // Allow HTTP/1.1 for compatibility
  //     key: fs.readFileSync(path.join(__dirname, 'server.key')),
  //     cert: fs.readFileSync(path.join(__dirname, 'server.cert')),
  //   },
  //   logger: true,
  // });

  // CORS middleware
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Headers', 'content-type');
  });

  // Handle OPTIONS requests
  app.options('/*', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*').header('Access-Control-Allow-Headers', 'content-type').send();
  });

  // Register Ticlo routes
  await connectTiclo(app, '/ticlo');
  await routeTiclo(app, '/api');

  // Root route
  app.get('/', async (request, reply) => {
    return '';
  });

  try {
    await app.listen({port: 8010, host: '0.0.0.0'});
    console.log('Server listening on http://localhost:8010');
    console.log(getEditorUrl('ws://127.0.0.1:8010/ticlo', 'example'));
    console.log('http://localhost:5173/editor.html?host=ws://127.0.0.1:8010/ticlo&flow=example');
    // For HTTPS/HTTP2:
    // console.log('Server listening on https://localhost:8010 (HTTP/2)');
    // console.log(getEditorUrl('wss://127.0.0.1:8010/ticlo', 'example'));
    // console.log('https://localhost:5173/editor.html?host=wss://127.0.0.1:8010/ticlo&flow=example');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
})();
