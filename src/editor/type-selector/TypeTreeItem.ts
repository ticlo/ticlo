import {TreeItem} from "../../ui/component/Tree";
import {ClientConnection} from "../../core/connect/ClientConnection";
import {FunctionDesc} from "../../core/block/Descriptor";
import {OnTypeClick} from "./TypeView";


export class TypeTreeItem extends TreeItem<TypeTreeItem> {
  root: TypeTreeRoot;
  desc: FunctionDesc;
  name?: string;
  data?: any;

  children: TypeTreeItem[] = [];

  static sort(a: TypeTreeItem, b: TypeTreeItem): number {
    if (!a.desc || !b.desc) {
      return a.key.localeCompare(b.key);
    }
    if (a.desc.order === b.desc.order) {
      return 0;
    }
    if (typeof a.desc.order !== 'number') {
      return 1;
    }
    if (typeof b.desc.order !== 'number') {
      return -1;
    }
    return (a.desc.order - b.desc.order);
  }

  constructor(parent: TypeTreeItem, root: TypeTreeRoot, key: string, desc?: FunctionDesc, data?: any) {
    super(parent);
    if (desc) {
      this.opened = 'empty';
    }
    this.key = key;
    this.update(desc, data);
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

  update(desc: FunctionDesc, data: any) {
    let changed = false;
    if (desc !== this.desc) {
      this.desc = desc;
      this.data = data;
      changed = true;
      if (desc) {
        // todo add additional children functions
        // a function desc can have predefined function with data
      }
    } else if (data !== this.data) {
      this.data = data;
      changed = true;
    }
    if (changed) {
      this.forceUpdate();
    }
  }

  addChild(key: string, desc?: FunctionDesc, data?: any) {
    for (let item of this.children) {
      if (item.key === key) {
        item.update(desc, data);
        return;
      }
    }
    let child = new TypeTreeItem(this, this.root, key, desc, data);
    this.children.push(child);
    this.children.sort(TypeTreeItem.sort);
    if (this.opened === 'opened') {
      this.onListChange();
    }
  }

  removeChild(key: string) {
    for (let i = 0; i < this.children.length; ++i) {
      let item = this.children[i];
      if (item.key === key) {
        this.children = this.children.splice(i, 1);
        if (this.opened === 'opened') {
          this.onListChange();
        }
        return;
      }
    }
  }
}

export class TypeTreeRoot extends TypeTreeItem {

  showPreset: boolean;
  onTypeClick: OnTypeClick;

  typeMap: Map<string, TypeTreeItem> = new Map<string, TypeTreeItem>();
  onDesc = (desc: FunctionDesc, key: string) => {
    if (desc) {
      let category = desc.category || desc.ns || 'other';
      let catKey = `ns:${category}`;
      let catItem: TypeTreeItem;
      if (this.typeMap.has(catKey)) {
        catItem = this.typeMap.get(catKey);
      } else {
        catItem = new TypeTreeItem(this, this, catKey);
        catItem.name = category;
        this.typeMap.set(catKey, catItem);
        this.children.push(catItem);
        this.onListChange();
      }

      let item = this.typeMap.get(key);
      if (item && item.parent !== catItem) {
        item.parent.removeChild(key);
      }
      catItem.addChild(key, desc);
    } else {
      // function desc is removed
      let item = this.typeMap.get(key);
      if (item) {
        this.typeMap.delete(key);
        item.parent.removeChild(key);
      }
    }
  };

  constructor(conn: ClientConnection, onListChange: () => void, showPreset?: boolean) {
    super(null, null, '');
    this.root = this;
    this.showPreset = Boolean(showPreset);
    this.connection = conn;
    this.onListChange = onListChange;
    conn.watchDesc('*', this.onDesc);
  }

  destroy() {
    this.connection.unwatchDesc(this.onDesc);
    super.destroy();
  }
}
