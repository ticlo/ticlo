import React from "react";
import marked from "marked";
import Dompurify from "dompurify";
import {ClientConnection} from "../../../core/connect/ClientConnection";
import {SpecialViewProps} from "./SpecialView";
import {LazyUpdateComponent, LazyUpdateListener} from "../../../ui/component/LazyUpdateComponent";

class NoteView extends LazyUpdateComponent<SpecialViewProps, any> {
  static fullView = true;

  private _rootNode!: HTMLElement;
  private getRef = (node: HTMLDivElement): void => {
    this._rootNode = node;
  };

  text = new LazyUpdateListener(this);
  background = new LazyUpdateListener(this);
  border = new LazyUpdateListener(this);
  color = new LazyUpdateListener(this);

  constructor(props: SpecialViewProps) {
    super(props);
    let {conn, path} = props;
    conn.subscribe(`${path}.text`, this.text, true);
    conn.subscribe(`${path}.background`, this.background, true);
    conn.subscribe(`${path}.border`, this.border, true);
    conn.subscribe(`${path}.color`, this.color, true);
  }

  renderImpl(): React.ReactNode {
    let rawHtml: string;
    let text = this.text.value;
    if (text) {
      let needSanitize = false;
      let markedOptions: marked.MarkedOptions = {
        sanitize: true,
        sanitizer(str: string) {
          needSanitize = true;
          return str;
        }
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
      <div ref={this.getRef} className='ticl-block-note' style={style} dangerouslySetInnerHTML={{__html: rawHtml}}/>
    );
  }

  componentDidUpdate(prevProps: Readonly<SpecialViewProps>, prevState: Readonly<any>, snapshot?: any): void {
    let {updateViewHeight} = this.props;
    updateViewHeight(this._rootNode.offsetHeight);
  }

  componentWillUnmount(): void {
    let {conn, path} = this.props;
    conn.unsubscribe(`${path}.text`, this.text);
    conn.unsubscribe(`${path}.background`, this.background);
    conn.unsubscribe(`${path}.border`, this.border);
    conn.unsubscribe(`${path}.color`, this.color);
    super.componentWillUnmount();
  }
}

ClientConnection.addEditorDescriptor('note',
  {
    view: NoteView,
    name: 'note',
    id: 'note',
    properties: [
      {name: 'text', type: 'string'},
      {name: 'color', type: 'color'},
      {name: 'background', type: 'color'},
      {name: 'border', type: 'string'},
    ]
  }
);
