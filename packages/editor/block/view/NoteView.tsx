import React from 'react';
import {marked, MarkedOptions} from 'marked';
import Dompurify from 'dompurify';
import {BlockWidgetProps} from './BlockWidget.js';
import {stringify as stringifyYaml} from 'yaml';
import {LazyUpdateComponent, LazyUpdateSubscriber} from '../../component/LazyUpdateComponent.js';
import {ClientConnection} from '@ticlo/core';
import {encodeSorted} from '@ticlo/core';
import {arrowReplacer, arrowReviver} from '@ticlo/core/util/Serialize.js';

class NoteView extends LazyUpdateComponent<BlockWidgetProps, any> {
  private _rootNode!: HTMLElement;
  private getRef = (node: HTMLDivElement): void => {
    this._rootNode = node;
  };

  input = new LazyUpdateSubscriber(this);
  mode = new LazyUpdateSubscriber(this);
  background = new LazyUpdateSubscriber(this);
  border = new LazyUpdateSubscriber(this);
  color = new LazyUpdateSubscriber(this);

  constructor(props: BlockWidgetProps) {
    super(props);
    let {conn, path} = props;
    this.input.subscribe(conn, `${path}.input`, true);
    this.mode.subscribe(conn, `${path}.mode`, true);
    this.background.subscribe(conn, `${path}.background`, true);
    this.border.subscribe(conn, `${path}.border`, true);
    this.color.subscribe(conn, `${path}.color`, true);
  }

  renderImpl(): React.ReactNode {
    let rawHtml: string;
    let text = this.input.value;
    let mode = this.mode.value;
    if (text) {
      if (mode === 'yaml') {
        rawHtml = `<pre>${Dompurify.sanitize(stringifyYaml(text, arrowReplacer))}</pre>`;
      } else if (mode === 'json') {
        rawHtml = `<pre>${Dompurify.sanitize(encodeSorted(text))}</pre>`;
      } else {
        // if (mode === 'markdown') {
        let markedOptions: MarkedOptions = {
          silent: true,
        };
        rawHtml = marked(text, markedOptions) as string;
        rawHtml = Dompurify.sanitize(rawHtml);
      }
    }
    let style: React.CSSProperties = {};
    if (typeof this.background.value === 'string') {
      style.background = this.background.value;
    }
    if (typeof this.border.value === 'string') {
      style.border = this.border.value;
    }
    if (typeof this.color.value === 'string') {
      style.color = this.color.value;
    }
    return (
      <div
        ref={this.getRef}
        className="ticl-block-note ticl-markdown"
        style={style}
        dangerouslySetInnerHTML={{__html: rawHtml}}
      />
    );
  }

  componentDidUpdate(prevProps: Readonly<BlockWidgetProps>, prevState: Readonly<any>, snapshot?: any): void {
    let {updateViewHeight} = this.props;
    updateViewHeight(this._rootNode.offsetHeight);
  }

  componentWillUnmount(): void {
    this.input.unsubscribe();
    this.mode.unsubscribe();
    this.background.unsubscribe();
    this.border.unsubscribe();
    this.color.unsubscribe();
    super.componentWillUnmount();
  }
}

ClientConnection.addEditorDescriptor('note', {
  view: NoteView,
  name: 'note',
  id: 'note',
  icon: 'fas:align-left',
  properties: [
    {name: 'input', type: 'any', mime: 'text/x-markdown'},
    {name: 'mode', type: 'select', options: ['markdown', 'json', 'yaml'], default: 'markdown'},
    {name: 'color', type: 'color'},
    {name: 'background', type: 'color'},
    {name: 'border', type: 'string'},
  ],
});
