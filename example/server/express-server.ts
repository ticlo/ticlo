import Express from 'express';
import {Root} from '../../src/core';
import '../../src/node';
import {connectTiclo, routeTiclo} from '../../src/express';
import {data} from '../sample-data/data';

let job = Root.instance.addJob('example');
job.load(data);

// create some global blocks
Root.instance._globalBlock.createBlock('^gAdd').setValue('#is', 'add');
Root.instance._globalBlock.createBlock('^gSub').setValue('#is', 'subtract');

let app = Express();
connectTiclo(app, '/ticlo');
routeTiclo(app, '/ticlo');

app.get('/', (req, res) => {
  res.end();
});

app.listen(8010);

console.log('listening on 8010');
console.log('http://ticlo.org/editor.html?host=ws://127.0.0.1:8010/ticlo&job=example');
