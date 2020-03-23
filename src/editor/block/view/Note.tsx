import React from 'react';
import marked from 'marked';
import Dompurify from 'dompurify';
import {BlockWidgetProps} from './BlockWidget';
import {LazyUpdateComponent, LazyUpdateSubscriber} from '../../component/LazyUpdateComponent';
import {ClientConnection} from '../../../../src/core/editor';

class NoteView extends LazyUpdateComponent<BlockWidgetProps, any> {
  private _rootNode!: HTMLElement;
  private getRef = (node: HTMLDivElement): void => {
    this._rootNode = node;
  };

  text = new LazyUpdateSubscriber(this);
  background = new LazyUpdateSubscriber(this);
  border = new LazyUpdateSubscriber(this);
  color = new LazyUpdateSubscriber(this);

  constructor(props: BlockWidgetProps) {
    super(props);
    let {conn, path} = props;
    this.text.subscribe(conn, `${path}.text`, true);
    this.background.subscribe(conn, `${path}.background`, true);
    this.border.subscribe(conn, `${path}.border`, true);
    this.color.subscribe(conn, `${path}.color`, true);
  }

  renderImpl(): React.ReactNode {
    let rawHtml: string;
    let text = this.text.value;
    if (text) {
      let needSanitize = false;
      let markedOptions: marked.MarkedOptions = {
        sanitize: true,
        silent: true,
        sanitizer(str: string) {
          needSanitize = true;
          return str;
        },
      };
      rawHtml = marked(this.text.value, markedOptions);
      if (needSanitize) {
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
      <div ref={this.getRef} className="ticl-block-note" style={style} dangerouslySetInnerHTML={{__html: rawHtml}} />
    );
  }

  componentDidUpdate(prevProps: Readonly<BlockWidgetProps>, prevState: Readonly<any>, snapshot?: any): void {
    let {updateViewHeight} = this.props;
    updateViewHeight(this._rootNode.offsetHeight);
  }

  componentWillUnmount(): void {
    let {conn, path} = this.props;
    this.text.unsubscribe();
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
    {name: 'text', type: 'string', mime: 'text/x-markdown'},
    {name: 'color', type: 'color'},
    {name: 'background', type: 'color'},
    {name: 'border', type: 'string'},
  ],
});
