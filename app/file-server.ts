import './styles.ts';
import {Root} from '@ticlo/core';
import {FrameServerConnection} from '@ticlo/html';
import {RemoteStorage} from '@ticlo/remote-storage';
import '@ticlo/react';
import '@ticlo/test';
import './sample-blocks.ts';

const params = new URLSearchParams(location.search);
const storage = new RemoteStorage({baseURL: params.get('host') || 'http://127.0.0.1:8010/file'});
const project = params.get('project') || '#root';

const button = document.querySelector('button');
const status = document.getElementById('status');
const editors: Window[] = [];

window.addEventListener('beforeunload', () => {
  for (const editor of editors) {
    if (!editor.closed) editor.close();
  }
});

Root.instance
  .setStorage(storage)
  .then(() =>
    Root.instance.start(
      params.has('project') || params.has('flow') ? {[project]: {flows: params.getAll('flow')}} : undefined
    )
  )
  .then(() => {
    status.textContent = `Loaded project: ${project}`;
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
