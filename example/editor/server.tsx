import {Block, FunctionDesc, Root} from '../../src/core';
import {makeLocalConnection} from '../../src/core/connect/LocalConnection';
import {data} from '../sample-data/data';
import reactData from '../sample-data/react';
import './sample-blocks';
import {Logger} from '../../src/core/util/Logger';
import {WorkerFunctionGen} from '../../src/core/worker/WorkerFunctionGen';
import '../../src/react';
import {FrameServerConnection} from '../../src/html';

WorkerFunctionGen.registerType({'#is': ''}, {name: 'class1'}, 'WorkerEditor');

let editors: Window[] = [];
window.addEventListener('beforeunload', () => {
  for (let editor of editors) {
    if (!editor.closed) {
      editor.close();
    }
  }
});

(async () => {
  let reactFlow = Root.instance.addFlow('example');
  reactFlow.load(reactData);

  let generalFlow = Root.instance.addFlow('example0');
  generalFlow.load(data);

  // create some global blocks
  Root.instance._globalRoot.createBlock('^gAdd').setValue('#is', 'add');
  Root.instance._globalRoot.createBlock('^gSub').setValue('#is', 'subtract');

  let [server, client] = makeLocalConnection(Root.instance);

  document.querySelector('button').addEventListener('click', () => {
    let w = window.open('/example/simple-editor/editor.html?flow=example', '_blank');
    editors.push(w);
    // tslint:disable-next-line:no-unused-expression
    new FrameServerConnection(w, Root.instance);
  });
})();

(window as any).Logger = Logger;
