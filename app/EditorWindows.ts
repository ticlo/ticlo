import type {Root} from '@ticlo/core';
import {FrameServerConnection} from '@ticlo/html';

export class EditorWindows {
  private editors: {window: Window; connection: FrameServerConnection}[] = [];

  constructor(
    private root: Root,
    private files?: {fileHost?: string; staticStorage?: boolean; project: string}
  ) {}

  open(path?: string) {
    const url = new URL('editor.html', location.href);
    if (path) url.searchParams.set('flow', path);
    if (this.files) {
      url.searchParams.set('project', this.files.project);
      if (this.files.fileHost) url.searchParams.set('fileHost', this.files.fileHost);
      else if (this.files.staticStorage) url.searchParams.set('storage', 'static');
    }
    const editor = window.open(url.href, '_blank', 'popup,width=1200,height=800');
    if (editor) this.editors.push({window: editor, connection: new FrameServerConnection(editor, this.root)});
    return editor;
  }

  close = () => {
    for (const editor of this.editors) {
      editor.connection.destroy();
      if (!editor.window.closed) editor.window.close();
    }
    this.editors = [];
  };
}
