import './styles.ts';
import {Block, FunctionDesc, Root} from '@ticlo/core';
import {makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {data} from './sample-data/data.ts';
import reactData from './sample-data/react.ts';
import './sample-blocks.ts';
import {Logger} from '@ticlo/core/util/Logger.ts';
import {WorkerFunctionGen} from '@ticlo/core/worker/WorkerFunctionGen.ts';
import '../packages/react/index.ts';
import {FrameServerConnection} from '@ticlo/html';
import {StaticStorage} from '@ticlo/remote-storage';
import {Namespace} from '@ticlo/core/block/Namespace.ts';

WorkerFunctionGen.registerType({'#is': ''}, {name: 'class1'}, '+WorkerEditor');

const editors: Window[] = [];
window.addEventListener('beforeunload', () => {
  for (const editor of editors) {
    if (!editor.closed) {
      editor.close();
    }
  }
});

(async () => {
  await Root.instance.setStorage(new StaticStorage(new URL('./storage', location.href).href));
  await Root.instance.start({local: {flows: ['**']}});

  const reactFlow = Root.instance.addFlow('+local.example');
  reactFlow.load(reactData);

  const generalFlow = Root.instance.addFlow('+local.example0');
  generalFlow.load(data);

  // create some global blocks
  Root.instance._globalRoot.createBlock('^gAdd').setValue('#is', 'add');
  Root.instance._globalRoot.createBlock('^gSub').setValue('#is', 'subtract');

  const [server, client] = makeLocalConnection(Root.instance);

  document.querySelector('button').addEventListener('click', () => {
    const w = window.open('./editor.html?flow=%2Blocal.example', '_blank');
    editors.push(w);
    new FrameServerConnection(w, Root.instance);
  });
})();

(window as any).Logger = Logger;
