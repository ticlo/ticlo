import {Block, FunctionDesc, Root} from '../../src/core/main';
import {makeLocalConnection} from '../../src/core/connect/LocalConnection';
import {data} from '../sample-data/data';
import './sample-blocks';
import {Logger} from '../../src/core/util/Logger';
import {WorkerFunction} from '../../src/core/worker/WorkerFunction';
import {FrameServerConnection} from '../../src/browser/connect/FrameServerConnection';

WorkerFunction.registerType({'#is': ''}, {name: 'class1'}, 'WorkerEditor');

(async () => {
  let job = Root.instance.addJob('example');
  job.load(data);

  // create some global blocks
  Root.instance._globalBlock.createBlock('^gAdd').setValue('#is', 'add');
  Root.instance._globalBlock.createBlock('^gSub').setValue('#is', 'subtract');

  let [server, client] = makeLocalConnection(Root.instance);

  document.querySelector('button').addEventListener('click', () => {
    let w = window.open('./editor-browser.html', '_blank');
    // tslint:disable-next-line:no-unused-expression
    new FrameServerConnection(w, Root.instance);
  });
})();

(window as any).Logger = Logger;
