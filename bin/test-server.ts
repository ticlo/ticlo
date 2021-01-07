import Express from 'express';
import {Root} from '../src/core';
import '../src/test';
import '../src/node';
import {connectTiclo, routeTiclo, getEditorUrl} from '../src/express';
import {TestLoader} from '../src/node/test-loader/TestLoader';

(async () => {
  await Root.instance.setStorage(new TestLoader(['./src/core', './src/express', './src/node', './src/http']));

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
