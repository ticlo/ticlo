import {TreeItem} from '../component/Tree';
import {ClientConn, FunctionDesc} from '../../../src/core/editor';
import {OnTypeClick} from './TypeView';

export class TypeTreeItem extends TreeItem<TypeTreeItem> {
  root: TypeTreeRoot;
  desc: FunctionDesc;
  name?: string;
  label: string;
  data?: any;

  children: TypeTreeItem[] = [];

  static sort(a: TypeTreeItem, b: TypeTreeItem): number {
    return a.name.localeCompare(b.name);
  }

  constructor(parent: TypeTreeItem, root: TypeTreeRoot, key: string, name?: string, desc?: FunctionDesc, data?: any) {
    super(parent);
    this.root = root;
    if (desc?.properties) {
      this.opened = 'empty';
    }
    this.name = name;
    this.label = name; // TODO: translate
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
    let child = new TypeTreeItem(this, this.root, key, desc.name, desc, data);
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

  matchFilter(filter: string): boolean {
    if (!filter) {
      return true;
    }
    return this.label.includes(filter) || this.key.includes(filter);
  }

  addToList(list: TypeTreeItem[], filter?: string) {
    if (this.matchFilter(filter)) {
      list.push(this);
      if (this.opened === 'opened' && this.children) {
        for (let child of this.children) {
          child.addToList(list);
        }
      }
    } else if (filter && this.children.length) {
      // check if there is any matched child
      let filterdChildren: TypeTreeItem[] = [];
      for (let child of this.children) {
        child.addToList(filterdChildren, filter);
      }

      let strongFilter = filter.length > 1 || filter.charCodeAt(0) > 128;

      if (filterdChildren.length) {
        list.push(this);
        if (strongFilter) {
          this.opened = 'opened';
        }
        if (this.opened === 'opened') {
          for (let child of filterdChildren) {
            list.push(child);
          }
        }
      } else if (strongFilter) {
        // close it if no child matches filter
        this.opened = 'closed';
      }
    }
  }
}

export class TypeTreeRoot extends TypeTreeItem {
  showPreset: boolean;
  onTypeClick: OnTypeClick;
  filter: (desc: FunctionDesc) => boolean;

  typeMap: Map<string, TypeTreeItem> = new Map<string, TypeTreeItem>();
  onDesc = (desc: FunctionDesc, key: string) => {
    if (desc) {
      if (this.filter && !this.filter(desc)) {
        return;
      }

      let category: string;
      let catKey: string;
      let catDesc: FunctionDesc;
      if (desc.properties) {
        // function
        category = desc.category || desc.ns || 'other';
        catKey = category;
      } else {
        // category
        category = desc.name;
        catKey = key;
        catDesc = desc;
      }

      let catItem: TypeTreeItem;
      if (this.typeMap.has(catKey)) {
        catItem = this.typeMap.get(catKey);
        if (catDesc) {
          catItem.update(catDesc, null);
        }
      } else {
        catItem = new TypeTreeItem(this, this, catKey, category, catDesc);
        this.typeMap.set(catKey, catItem);
        this.children.push(catItem);
        this.onListChange();
      }
      if (!catDesc) {
        let item = this.typeMap.get(key);
        if (item && item.parent !== catItem) {
          item.parent.removeChild(key);
        }
        catItem.addChild(key, desc);
      }
    } else {
      // function desc is removed
      let item = this.typeMap.get(key);
      if (item) {
        this.typeMap.delete(key);
        item.parent.removeChild(key);
      }
    }
  };

  constructor(
    conn: ClientConn,
    onListChange: () => void,
    onTypeClick?: OnTypeClick,
    showPreset?: boolean,
    filter?: (desc: FunctionDesc) => boolean
  ) {
    super(null, null, '');
    this.level = -1;
    this.root = this;
    this.showPreset = Boolean(showPreset);
    this.connection = conn;
    this.onListChange = onListChange;
    this.onTypeClick = onTypeClick;
    this.filter = filter;
    conn.watchDesc('*', this.onDesc);
  }

  destroy() {
    this.connection.unwatchDesc(this.onDesc);
    super.destroy();
  }
}
