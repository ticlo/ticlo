import Express from 'express';
import {connectTiclo} from '../../src/nodejs/express/server';
import {data} from '../sample-data/data';
import {Root} from '../../src/core/main';

let job = Root.instance.addJob('example');
job.load(data);

// create some global blocks
Root.instance._globalBlock.createBlock('^gAdd').setValue('#is', 'add');
Root.instance._globalBlock.createBlock('^gSub').setValue('#is', 'subtract');

let app = Express();
connectTiclo(app, '/ticlo');
app.listen(8010);

console.log('listening on 8010');
