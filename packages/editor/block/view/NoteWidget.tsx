import React from 'react';
import {BlockWidget, BlockWidgetProps} from './BlockWidget';
import {stringify as stringifyYaml} from 'yaml';
import {LazyUpdateComponent, LazyUpdateSubscriber} from '../../component/LazyUpdateComponent';
import {PropDesc} from '@ticlo/core';
import {marked, MarkedOptions} from 'marked';
import Dompurify from 'dompurify';
import ResizeObserver from 'resize-observer-polyfill';
import {encodeSorted} from '@ticlo/core';

import {arrowReplacer, arrowReviver} from '@ticlo/core/util/Serialize';
import {stringify} from 'yaml/dist/public-api';

class CommentView extends LazyUpdateComponent<BlockWidgetProps, any> {
  static readonly viewProperties: PropDesc[] = [
    {name: '@b-note', type: 'any', mime: 'text/x-markdown'},
    {name: '@b-note-mode', type: 'select', options: ['markdown', 'json', 'yaml'], default: 'markdown'},
  ];

  #rootNode!: HTMLElement;
  private getRef = (node: HTMLDivElement): void => {
    this.#rootNode = node;
    if (node && !this.#resizeObserver) {
      this.#resizeObserver = new ResizeObserver(this.handleResize);
      this.#resizeObserver.observe(node);
    }
  };

  #resizeObserver: ResizeObserver;

  note = new LazyUpdateSubscriber(this);
  mode = new LazyUpdateSubscriber(this);

  constructor(props: BlockWidgetProps) {
    super(props);
    let {conn, path} = props;
    this.note.subscribe(conn, `${path}.@b-note`, true);
    this.mode.subscribe(conn, `${path}.@b-note-mode`, true);
  }

  renderImpl(): React.ReactNode {
    let rawHtml: string;
    const text = this.note.value;
    const mode = this.mode.value;
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
    this.note.unsubscribe();
    super.componentWillUnmount();
  }
}
BlockWidget.register('note', CommentView);
