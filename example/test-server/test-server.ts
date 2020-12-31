import Express from 'express';
import {Root} from '../../src/core';
import {connectTiclo, routeTiclo, getEditorUrl} from '../../src/express';
import {data} from '../sample-data/data';
import {TestLoader} from '../../src/node/test-loader/TestLoader';

(async () => {
  // create some global blocks
  Root.instance._globalRoot.createBlock('^gAdd').setValue('#is', 'add');
  Root.instance._globalRoot.createBlock('^gSub').setValue('#is', 'subtract');

  await Root.instance.setStorage(new TestLoader(['./src/core', './src/express', './src/node']));

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
