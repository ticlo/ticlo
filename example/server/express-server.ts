import Express from 'express';
import {Flow, Root, setStorageFunctionProvider} from '@ticlo/core';
import {FileFlowStorage, FileStorage} from '@ticlo/node';
import {connectTiclo, routeTiclo, getEditorUrl} from '@ticlo/web-server';
import '@ticlo/test';
import {data} from '../sample-data/data';
import reactData from '../sample-data/react';

(async () => {
  setStorageFunctionProvider(() => new FileStorage('./example/server/storage', '.str'));

  // create some global blocks
  Root.instance._globalRoot.createBlock('^gAdd').setValue('#is', 'add');
  Root.instance._globalRoot.createBlock('^gSub').setValue('#is', 'subtract');

  await Root.instance.setStorage(new FileFlowStorage('./example/server/flows'));

  if (!(Root.instance.getValue('example') instanceof Flow)) {
    console.log('initialize the database');
    let flow = Root.instance.addFlow('example', data);
  }

  let app = Express();
  app.all('/*aPath', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'content-type');
    next();
  });
  // app.options('/*', function (req, res, next) {
  //   res.header('Access-Control-Allow-Headers', 'content-type');
  //   next();
  // });
  connectTiclo(app, '/ticlo');
  routeTiclo(app, '/api');

  app.get('/', (req, res) => {
    res.end();
  });

  app.listen(8010, () => {
    console.log('listening on 8010');
    console.log(getEditorUrl('ws://127.0.0.1:8010/ticlo', 'example'));
  });
})();
