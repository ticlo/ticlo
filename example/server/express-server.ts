import Express from 'express';
import {Root, setStorageFunctionProvider} from '@ticlo/core';
import {FileFlowStorage, FileStorage} from '@ticlo/node';
import {connectTiclo, routeTiclo, getEditorUrl} from '@ticlo/web-server';
import '@ticlo/test';
import {data} from '../sample-data/data';

(async () => {
  setStorageFunctionProvider(() => new FileStorage('./example/server/storage', '.str'));

  let flow = Root.instance.addFlow('example', data);

  // create some global blocks
  Root.instance._globalRoot.createBlock('^gAdd').setValue('#is', 'add');
  Root.instance._globalRoot.createBlock('^gSub').setValue('#is', 'subtract');

  await Root.instance.setStorage(new FileFlowStorage('./example/server/flows'));

  let app = Express();
  app.all('/*', function (req, res, next) {
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
