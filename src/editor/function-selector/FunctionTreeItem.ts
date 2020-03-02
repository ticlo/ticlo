import {TreeItem} from '../component/Tree';
import {ClientConn, FunctionDesc} from '../../../src/core/editor';
import {OnFunctionClick} from './FunctionView';

export class FunctionTreeItem extends TreeItem<FunctionTreeItem> {
  root: FunctionTreeRoot;
  desc: FunctionDesc;
  name?: string;
  label: string;
  data?: any;

  children: FunctionTreeItem[] = [];

  static sort(a: FunctionTreeItem, b: FunctionTreeItem): number {
    return a.name.localeCompare(b.name);
  }

  constructor(
    parent: FunctionTreeItem,
    root: FunctionTreeRoot,
    key: string,
    name?: string,
    desc?: FunctionDesc,
    data?: any
  ) {
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

  addChild(key: string, desc?: FunctionDesc, data?: any): FunctionTreeItem {
    for (let item of this.children) {
      if (item.key === key) {
        item.update(desc, data);
        return item;
      }
    }
    let child = new FunctionTreeItem(this, this.root, key, desc.name, desc, data);
    this.children.push(child);
    this.children.sort(FunctionTreeItem.sort);
    if (this.opened === 'opened') {
      this.onListChange();
    }
    return child;
  }

  removeChild(key: string) {
    for (let i = 0; i < this.children.length; ++i) {
      let item = this.children[i];
      if (item.key === key) {
        this.children.splice(i, 1);
        if (this.children.length === 0 && !this.desc) {
          this.parent.removeChild(this.key);
        } else if (this.opened === 'opened') {
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

  addToList(list: FunctionTreeItem[], filter?: string) {
    if (this.matchFilter(filter)) {
      list.push(this);
      if (this.opened === 'opened' && this.children) {
        for (let child of this.children) {
          child.addToList(list);
        }
      }
    } else if (filter && this.children.length) {
      // check if there is any matched child
      let filterdChildren: FunctionTreeItem[] = [];
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

export class FunctionTreeRoot extends FunctionTreeItem {
  showPreset: boolean;
  onFunctionClick: OnFunctionClick;
  filter: (desc: FunctionDesc) => boolean;

  typeMap: Map<string, FunctionTreeItem> = new Map<string, FunctionTreeItem>();

  updateCategory(catKey: string, name: string, desc?: FunctionDesc): FunctionTreeItem {
    let catItem: FunctionTreeItem;
    if (this.typeMap.has(catKey)) {
      catItem = this.typeMap.get(catKey);
      if (desc) {
        catItem.update(desc, null);
      }
    } else {
      let parentItem: FunctionTreeItem = this;
      if (catKey.length > 1) {
        let colonIndex = catKey.lastIndexOf(':', catKey.length - 2);
        if (colonIndex > -1) {
          let parentCateKey = catKey.substring(0, colonIndex);
          let parentCateName = parentCateKey.split(':').pop();
          parentItem = this.updateCategory(parentCateKey + ':', parentCateName);
        }
      }

      catItem = new FunctionTreeItem(parentItem, this, catKey, name, desc);
      this.typeMap.set(catKey, catItem);
      parentItem.children.push(catItem);
      this.onListChange();
    }
    return catItem;
  }

  onDesc = (desc: FunctionDesc, key: string) => {
    let item = this.typeMap.get(key);
    if (item && item.desc) {
      // remove existing function first
      this.typeMap.delete(key);
      item.parent.removeChild(key);
    }

    if (desc) {
      if (desc.src === 'base') {
        // dont show base functions
        return;
      }
      if (this.filter && !this.filter(desc)) {
        return;
      }
      let category = desc.category || desc.ns;
      if (category == null && desc.properties) {
        category = 'other'; // TODO remove other
      }
      let catKey = `${category}:`;

      let parentItem: FunctionTreeItem = this;
      if (category != null) {
        parentItem = this.updateCategory(catKey, category);
      }

      if (desc.properties) {
        this.typeMap.set(desc.id, parentItem.addChild(key, desc));
      } else {
        this.updateCategory(desc.id, desc.name, desc);
      }
    }
  };

  constructor(
    conn: ClientConn,
    onListChange: () => void,
    onFunctionClick?: OnFunctionClick,
    showPreset?: boolean,
    filter?: (desc: FunctionDesc) => boolean
  ) {
    super(null, null, '');
    this.level = -1;
    this.root = this;
    this.showPreset = Boolean(showPreset);
    this.connection = conn;
    this.onListChange = onListChange;
    this.onFunctionClick = onFunctionClick;
    this.filter = filter;
    conn.watchDesc('*', this.onDesc);
  }

  destroy() {
    this.connection.unwatchDesc(this.onDesc);
    super.destroy();
  }
}
