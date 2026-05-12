import {serve} from '@hono/node-server';
import {Flow, Root, setStorageFunctionProvider} from '@ticlo/core';
import {FileFlowStorage, FileStorage} from '@ticlo/node';
import {createTicloApp, getEditorUrl} from '@ticlo/web-server/server.js';
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

  const {app, ticloWs} = await createTicloApp({enableEditor: true});

  try {
    const server = serve({fetch: app.fetch, port: 8010, hostname: '0.0.0.0'});
    ticloWs?.injectWebSocket(server);
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
