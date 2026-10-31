import type {Root} from '@ticlo/core';
import {FrameServerConnection} from '@ticlo/html';

export class EditorWindows {
  private editors: {window: Window; connection: FrameServerConnection}[] = [];

  constructor(private root: Root) {}

  open(path: string) {
    const url = new URL('editor.html', location.href);
    url.searchParams.set('flow', path);
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
