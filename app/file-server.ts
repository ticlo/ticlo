import {Root} from '@ticlo/core';
import {FrameServerConnection} from '@ticlo/html';
import {FileServerFlowStorage, TicloFileClient} from '@ticlo/remote-storage';
import '@ticlo/react';
import '@ticlo/test';
import './sample-blocks.ts';

const params = new URLSearchParams(location.search);
const client = new TicloFileClient({baseURL: params.get('host') || 'http://127.0.0.1:8012/file'});
const project = params.get('project') || '#root';
const storage = new FileServerFlowStorage(client);
const button = document.querySelector('button');
const status = document.getElementById('status');
const editors: Window[] = [];

storage.errors.listen((error) => {
  status.textContent = `Storage error: ${error.message}. Reload to get the latest files before retrying a conflicting save.`;
});
window.addEventListener('beforeunload', () => {
  for (const editor of editors) {
    if (!editor.closed) editor.close();
  }
});

Root.instance
  .setStorage(storage)
  .then(() => Root.instance.start({[project]: {flows: params.getAll('flow')}}))
  .then(() => {
    status.textContent = `Loaded projects: ${[...storage.projects].join(', ')}`;
    button.disabled = false;
    button.addEventListener('click', () => {
      const editor = window.open('./editor.html', '_blank');
      if (editor) {
        editors.push(editor);
        new FrameServerConnection(editor, Root.instance);
      }
    });
  })
  .catch((error) => {
    status.textContent = `Failed to load flows: ${error.message}`;
  });
