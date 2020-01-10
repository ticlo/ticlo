import {Block, FunctionDesc, Root} from '../../src/core';
import {makeLocalConnection} from '../../src/core/connect/LocalConnection';
import {data} from '../sample-data/data';
import reactData from '../sample-data/react';
import './sample-blocks';
import {Logger} from '../../src/core/util/Logger';
import {WorkerFunction} from '../../src/core/worker/WorkerFunction';
import '../../src/react';
import {FrameServerConnection} from '../../src/html';

WorkerFunction.registerType({'#is': ''}, {name: 'class1'}, 'WorkerEditor');

let editors: Window[] = [];
window.addEventListener('beforeunload', () => {
  for (let editor of editors) {
    if (!editor.closed) {
      editor.close();
    }
  }
});

(async () => {
  let reactJob = Root.instance.addJob('example');
  reactJob.load(reactData);

  let generalJob = Root.instance.addJob('example0');
  generalJob.load(data);

  // create some global blocks
  Root.instance._globalBlock.createBlock('^gAdd').setValue('#is', 'add');
  Root.instance._globalBlock.createBlock('^gSub').setValue('#is', 'subtract');

  let [server, client] = makeLocalConnection(Root.instance);

  document.querySelector('button').addEventListener('click', () => {
    let w = window.open('https://ticlo.org/editor.html?job=example', '_blank');
    editors.push(w);
    // tslint:disable-next-line:no-unused-expression
    new FrameServerConnection(w, Root.instance);
  });
})();

(window as any).Logger = Logger;
