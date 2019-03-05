import React from "react";
import Marked from "marked";
import {ClientConnection} from "../../../common/connect/ClientConnection";
import {SpecialViewProps} from "./SpecialView";
import {LazyUpdateComponent, LazyUpdateListener} from "../../../ui/component/LazyUpdateComponent";

class NoteView extends LazyUpdateComponent<SpecialViewProps, any> {
  static fullView = true;

  text = new LazyUpdateListener(this);
  background = new LazyUpdateListener(this);
  border = new LazyUpdateListener(this);

  constructor(props: SpecialViewProps) {
    super(props);
    let {conn, path} = props;
    conn.subscribe(`${path}.text`, this.text, true);
    conn.subscribe(`${path}.background`, this.background, true);
    conn.subscribe(`${path}.border`, this.border, true);
  }

  renderImpl(): React.ReactNode {
    let rawHtml: string;
    let text = this.text.value;
    if (text) {
      rawHtml = Marked(this.text.value);
    }
    let style: React.CSSProperties = {};
    if (typeof this.background.value === 'string') {
      style.background = this.background.value;
    }
    if (typeof this.border.value === 'string') {
      style.border = this.border.value;
    }
    return (
      <div className='ticl-block-note' style={style} dangerouslySetInnerHTML={{__html: rawHtml}}/>
    );
  }

  componentWillUnmount(): void {
    let {conn, path} = this.props;
    conn.unsubscribe(`${path}.text`, this.text);
    conn.unsubscribe(`${path}.background`, this.text);
    conn.unsubscribe(`${path}.border`, this.text);
    super.componentWillUnmount();
  }
}

ClientConnection.addEditorType('note',
  {
    view: NoteView,
    name: 'note',
    properties: [
      {name: 'text', type: 'string'},
      {name: 'background', type: 'string'},
      {name: 'border', type: 'string'},
    ]
  }
);
