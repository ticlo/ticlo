import {TreeItem} from "../../ui/component/Tree";
import {ClientConnection} from "../../core/connect/ClientConnection";
import {FunctionDesc} from "../../core/block/Descriptor";

export class TypeTreeItem extends TreeItem<TypeTreeItem> {
  conn: ClientConnection;
  desc: FunctionDesc;
  data?: any;

  constructor(parent: TypeTreeItem, desc?: FunctionDesc, data?: any) {
    super(parent);
    this.desc = desc;
    this.data = data;
  }


  getConn(): ClientConnection {
    return this.conn;
  }

  open() {
    this.opened = 'opened';
    this.forceUpdate();
    if (this.children.length) {
      this.onListChange();
    }
  }

  close() {
    this.opened = 'closed';
    this.forceUpdate();
    if (this.children.length) {
      this.onListChange();
    }
  }

  addChild(id: string, desc?: FunctionDesc, data?: any) {
    for (let item of this.children) {

    }
  }

  removeChild(id: string) {

  }
}

export class TypeTreeRoot extends TypeTreeItem {
  descMap: Map<string, FunctionDesc> = new Map<string, FunctionDesc>();
  onDesc = (desc: FunctionDesc, id: string) => {

  };

  constructor(conn: ClientConnection, onListChange: () => void) {
    super(null);
    this.connection = conn;
    this.onListChange = onListChange;
  }

}
