import {Block, FunctionDesc, Root} from '@ticlo/core';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection';
import {data} from './sample-data/data';
import reactData from './sample-data/react';
import './sample-blocks';
import {Logger} from '@ticlo/core/util/Logger';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen';
import '../packages/react';
import {FrameServerConnection} from '@ticlo/html';
import {IndexDbFlowStorage} from '@ticlo/html/storage/IndexDbStorage';

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
  await Root.instance.setStorage(new IndexDbFlowStorage());

  let reactFlow = Root.instance.addFlow('example');
  reactFlow.load(reactData);

  let generalFlow = Root.instance.addFlow('example0');
  generalFlow.load(data);

  // create some global blocks
  Root.instance._globalRoot.createBlock('^gAdd').setValue('#is', 'add');
  Root.instance._globalRoot.createBlock('^gSub').setValue('#is', 'subtract');

  let [server, client] = makeLocalConnection(Root.instance);

  document.querySelector('button').addEventListener('click', () => {
    let w = window.open('/app/simple-editor/editor.html?flow=example', '_blank');
    editors.push(w);
    new FrameServerConnection(w, Root.instance);
  });
})();

(window as any).Logger = Logger;
