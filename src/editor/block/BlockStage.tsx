import * as React from "react";
import {ClientConnection} from "../../common/connect/ClientConnection";
import {DataMap} from "../../common/util/Types";
import {BlockItem, LinkItem, FieldItem, Stage} from "./Block";

interface Props {
  conn: ClientConnection;
  basePath: string;
  style?: React.CSSProperties;
}

interface State {

}

export default class BlockStage extends React.Component<Props, State> implements Stage {


  _blocks: Map<string, BlockItem> = new Map<string, BlockItem>();
  _links: Map<string, LinkItem> = new Map<string, LinkItem>();
  _fields: Map<string, FieldItem> = new Map<string, FieldItem>();

  watchListener = {
    onUpdate: (response: DataMap) => {
      let changes = response.changes;
      for (let name in changes) {
        let change = changes[name];
        if (change === null) {
          if (this._blocks.has(name)) {
            this._blocks.set(name, new BlockItem(`${this.props.basePath}.${name}`));
            this.forceUpdate();
          }
        } else {
          if (!this._blocks.has(name)) {
            this._blocks.delete(name);
            this.forceUpdate();
          }
        }
      }
    }
  };

  constructor(props: Props) {
    super(props);
    props.conn.watch(props.basePath, this.watchListener);
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    if (nextProps.basePath !== this.props.basePath) {
      // TODO clear cached blocks
      this.props.conn.unwatch(this.props.basePath, this.watchListener);
      this.props.conn.watch(nextProps.basePath, this.watchListener);
    }
    return true;
  }

  render() {
    let {style} = this.props;

    let children: React.ReactNode[] = [];
    for (let [key, blockItem] of this._blocks) {
      children.push(blockItem.render());
    }

    return (
      <div style={style} className="ticl-block-stage">
        {children}
      </div>
    );
  }

  componentWillUnmount() {
    this.props.conn.unwatch(this.props.basePath, this.watchListener);
  }
}
