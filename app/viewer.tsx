import '@ticlo/react/style/index.css';
import './viewer.scss';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Flow, Root} from '@ticlo/core';
import {TicloPage, useValue} from '@ticlo/react';
import {RemoteStorage, StaticStorage} from '@ticlo/remote-storage';
import {designerData} from './sample-data/designer.ts';
import {EditorWindows} from './EditorWindows.ts';
import {pageFlowPath} from './flow-path.ts';

function Viewer({root, path}: {root: Root; path: string}) {
  const value = useValue(root, path);
  return (
    <div className="ticl-viewer-page">
      {value instanceof Flow ? (
        <TicloPage block={value} key={value._blockId} fallback={<div>This flow has no page.</div>} />
      ) : (
        <div>This flow is not available.</div>
      )}
    </div>
  );
}

window.addEventListener('hashchange', () => location.reload());

(async () => {
  const params = new URLSearchParams(location.hash.slice(1));
  const selected = pageFlowPath(params);
  if (!selected) throw new Error('Missing path. Use #path=namespace/flow.');
  const root = Root.instance;
  const host = params.get('host');
  await root.setStorage(
    host ? new RemoteStorage({baseURL: host}) : new StaticStorage(new URL('./storage', location.href).href)
  );
  const sample =
    !host &&
    selected.path === '+local.designer-example' &&
    !(await root.listFlows('local')).some(({name}) => name === 'designer-example');
  await root.start({[selected.ref.namespace]: {flows: sample ? [] : [selected.ref.name]}});
  if (sample) root.addFlow(selected.path, designerData);
  if (!(root.queryValue(selected.path) instanceof Flow)) throw new Error(`Flow is not available: ${selected.path}`);

  const editors = new EditorWindows(root);
  (window as typeof window & {openFlowEditor: () => Window | null}).openFlowEditor = () => editors.open(selected.path);
  window.addEventListener('beforeunload', editors.close);
  createRoot(document.getElementById('app')).render(<Viewer root={root} path={selected.path} />);
})().catch((error) => {
  console.error(error);
  document.getElementById('app').textContent = `Failed to load viewer: ${error.message}`;
});
