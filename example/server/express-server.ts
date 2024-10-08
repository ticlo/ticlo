import Express from 'express';
import {Root, setStorageFunctionProvider} from '@ticlo/core';
import {FileFlowStorage, FileStorage} from '@ticlo/node';
import {connectTiclo, routeTiclo, getEditorUrl} from '@ticlo/web-server';
import {data} from '../sample-data/data';

(async () => {
  setStorageFunctionProvider(() => new FileStorage('./example/server/storage', '.str'));

  let flow = Root.instance.addFlow('example', data);

  // create some global blocks
  Root.instance._globalRoot.createBlock('^gAdd').setValue('#is', 'add');
  Root.instance._globalRoot.createBlock('^gSub').setValue('#is', 'subtract');

  await Root.instance.setStorage(new FileFlowStorage('./example/server/flows'));

  let app = Express();
  connectTiclo(app, '/ticlo');
  routeTiclo(app, '/ticlo');

  app.get('/', (req, res) => {
    res.end();
  });

  app.listen(8010, () => {
    console.log('listening on 8010');
    console.log(getEditorUrl('ws://127.0.0.1:8010/ticlo', 'example'));
  });
})();
