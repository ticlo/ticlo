import React from 'react';
import {BlockWidget, BlockWidgetProps} from './BlockWidget';
import {LazyUpdateComponent, LazyUpdateSubscriber} from '../../component/LazyUpdateComponent';
import {PropDesc} from '../../../../src/core/editor';
import {marked, MarkedOptions} from 'marked';
import Dompurify from 'dompurify';
import ResizeObserver from 'resize-observer-polyfill';

class CommentView extends LazyUpdateComponent<BlockWidgetProps, any> {
  static readonly viewProperties: PropDesc[] = [{name: '@b-comment', type: 'string', mime: 'text/x-markdown'}];

  #rootNode!: HTMLElement;
  private getRef = (node: HTMLDivElement): void => {
    this.#rootNode = node;
    if (node && !this.#resizeObserver) {
      this.#resizeObserver = new ResizeObserver(this.handleResize);
      this.#resizeObserver.observe(node);
    }
  };

  #resizeObserver: ResizeObserver;

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
      let markedOptions: MarkedOptions = {
        silent: true,
      };
      rawHtml = marked(text, markedOptions) as string;
      rawHtml = Dompurify.sanitize(rawHtml);
    }
    return (
      <div ref={this.getRef} className="ticl-comment-view ticl-markdown" dangerouslySetInnerHTML={{__html: rawHtml}} />
    );
  }
  #lastHeight = -1;
  handleResize = () => {
    if (this.#rootNode.offsetHeight !== this.#lastHeight) {
      this.#lastHeight = this.#rootNode.offsetHeight;
      let {updateViewHeight} = this.props;
      updateViewHeight(this.#rootNode.offsetHeight + 6); // + 2 padding px and 4 border px
    }
  };

  componentWillUnmount(): void {
    let {conn, path} = this.props;
    this.#resizeObserver?.disconnect();
    this.comment.unsubscribe();
    super.componentWillUnmount();
  }
}
BlockWidget.register('comment', CommentView);
