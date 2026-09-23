import {Root} from '@ticlo/core';
import {FrameServerConnection, StaticFlowStorage} from '@ticlo/html';
import '@ticlo/react';
import '@ticlo/test';
import './sample-blocks.ts';

const editors: Window[] = [];
window.addEventListener('beforeunload', () => {
  for (const editor of editors) {
    if (!editor.closed) {
      editor.close();
    }
  }
});

const button = document.querySelector('button');
const status = document.getElementById('status');
const params = new URLSearchParams(location.search);
const host = params.get('host') || 'http://127.0.0.1:8011';
const storage = new StaticFlowStorage(host, params.get('project') || '_root');

(async () => {
  await Root.instance.setStorage(storage);
  status.textContent = `Loaded projects: ${[...storage.projects].join(', ')}`;
  button.disabled = false;
  button.addEventListener('click', () => {
    const editor = window.open('./editor.html', '_blank');
    if (editor) {
      editors.push(editor);
      new FrameServerConnection(editor, Root.instance);
    }
  });
})().catch((error) => {
  status.textContent = `Failed to load flows: ${error.message}`;
  console.error(error);
});
