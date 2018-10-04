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
      for (let key in changes) {

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

    return (
        <div style={style} className="ticl-block-stage">

        </div>
    );
  }

  componentWillUnmount() {
    this.props.conn.unwatch(this.props.basePath, this.watchListener);
  }
}
