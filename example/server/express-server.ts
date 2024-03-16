import Express from 'express';
import {Root} from '../../src/core';
import {FileFlowStorage} from '../../src/node';
import {connectTiclo, routeTiclo, getEditorUrl} from '../../src/web-server';
import {data} from '../sample-data/data';

(async () => {
  let flow = Root.instance.addFlow('example', data);

  // create some global blocks
  Root.instance._globalRoot.createBlock('^gAdd').setValue('#is', 'add');
  Root.instance._globalRoot.createBlock('^gSub').setValue('#is', 'subtract');

  await Root.instance.setStorage(new FileFlowStorage('./example/server'));

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
