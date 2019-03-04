import React from "react";
import Marked from "marked";
import {FunctionDesc, PropDesc, PropGroupDesc} from "../../../common/block/Descriptor";
import {ClientConnection} from "../../../common/connect/ClientConnection";
import {SpecialViewProps} from "./SpecialView";
import {LazyUpdateComponent, LazyUpdateListener} from "../../../ui/component/LazyUpdateComponent";

const markedOptions: Marked.MarkedOptions = {};

class NoteView extends LazyUpdateComponent<SpecialViewProps, any> {
  static fullView = true;

  text = new LazyUpdateListener(this);
  html = new LazyUpdateListener(this);
  background = new LazyUpdateListener(this);
  border = new LazyUpdateListener(this);

  constructor(props: SpecialViewProps) {
    super(props);
    let {conn, path} = props;
    conn.subscribe(`${path}.text`, this.text, true);
    conn.subscribe(`${path}.html`, this.html, true);
    conn.subscribe(`${path}.background`, this.background, true);
    conn.subscribe(`${path}.border`, this.border, true);
  }

  renderImpl(): React.ReactNode {
    let rawHtml: string;
    let text = this.text.value;
    if (text) {
      if (this.html.value) {

      } else {
        rawHtml = Marked(this.text.value, markedOptions);
      }
    }

    return (
      <div className='ticl-block-note' dangerouslySetInnerHTML={{__html: rawHtml}}/>
    );
  }

  componentWillUnmount(): void {
    let {conn, path} = this.props;
    conn.unsubscribe(`${path}.text`, this.text);
    conn.unsubscribe(`${path}.html`, this.text);
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
      {name: 'html', type: 'toggle', default: false},
      {name: 'background', type: 'string'},
      {name: 'border', type: 'string'},
    ]
  }
);
