import Express from 'express';
import {Root} from '../../src/core';
import {FileStorage} from '../../src/node';
import {connectTiclo, routeTiclo, getEditorUrl} from '../../src/express';
import {data} from '../sample-data/data';

let job = Root.instance.addJob('example', data);

// create some global blocks
Root.instance._globalBlock.createBlock('^gAdd').setValue('#is', 'add');
Root.instance._globalBlock.createBlock('^gSub').setValue('#is', 'subtract');

Root.instance.setStorage(new FileStorage('./example/server'));

let app = Express();
connectTiclo(app, '/ticlo');
routeTiclo(app, '/ticlo');

app.get('/', (req, res) => {
  res.end();
});

app.listen(8010);

console.log('listening on 8010');
console.log(getEditorUrl('ws://127.0.0.1:8010/ticlo', 'example'));
