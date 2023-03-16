import React from 'react';
import {BlockWidget, BlockWidgetProps} from './BlockWidget';
import {LazyUpdateComponent, LazyUpdateSubscriber} from '../../component/LazyUpdateComponent';
import {PropDesc} from '../../../../src/core/editor';
import {marked} from 'marked';
import Dompurify from 'dompurify';

class CommentView extends LazyUpdateComponent<BlockWidgetProps, any> {
  static readonly viewProperties: PropDesc[] = [{name: '@b-comment', type: 'string', mime: 'text/x-markdown'}];

  private _rootNode!: HTMLElement;
  private getRef = (node: HTMLDivElement): void => {
    this._rootNode = node;
  };

  comment = new LazyUpdateSubscriber(this);

  constructor(props: BlockWidgetProps) {
    super(props);
    let {conn, path} = props;
    this.comment.subscribe(conn, `${path}.@b-comment`, true);
  }

  renderImpl(): React.ReactNode {
    let rawHtml: string;
    let text = this.comment.value;
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
      rawHtml = marked(text, markedOptions);
      if (needSanitize) {
        rawHtml = Dompurify.sanitize(rawHtml);
      }
    }
    return (
      <div ref={this.getRef} className="ticl-comment-view ticl-markdown" dangerouslySetInnerHTML={{__html: rawHtml}} />
    );
  }

  componentDidUpdate(prevProps: Readonly<BlockWidgetProps>, prevState: Readonly<any>, snapshot?: any): void {
    let {updateViewHeight} = this.props;
    updateViewHeight(this._rootNode.offsetHeight + 6); // + 2 padding px and 4 border px
  }
  componentWillUnmount(): void {
    let {conn, path} = this.props;
    this.comment.unsubscribe();
    super.componentWillUnmount();
  }
}
BlockWidget.register('comment', CommentView);
