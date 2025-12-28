import {TreeItem} from '../component/Tree.js';
import {ClientConn, FunctionDesc, getKeywords, translateFunction} from '@ticlo/core/editor.js';
import {OnFunctionClick} from './FunctionView.js';
import i18next from 'i18next';

export class FunctionTreeItem extends TreeItem<FunctionTreeItem> {
  root: FunctionTreeRoot;
  desc: FunctionDesc;
  name?: string;
  data?: any;
  // used in searching
  keywords: {[lng: string]: string} = {};
  names: {[lng: string]: string} = {};

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
    this.key = key;
    if (key == null) {
      debugger;
    }
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
    for (const item of this.children) {
      if (item.key === key) {
        item.update(desc, data);
        return item;
      }
    }
    const child = new FunctionTreeItem(this, this.root, key, desc.name, desc, data);
    this.children.push(child);
    this.children.sort(FunctionTreeItem.sort);
    if (this.opened === 'opened') {
      this.onListChange();
    }
    return child;
  }

  removeChild(key: string) {
    for (let i = 0; i < this.children.length; ++i) {
      const item = this.children[i];
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
  matchKeywords(lng: string, search: string) {
    if (!Object.hasOwn(this.names, lng)) {
      this.names[lng] = translateFunction(this.desc.id, this.name, this.desc.ns, lng)?.toLowerCase();
      this.keywords[lng] = getKeywords(this.desc.name, this.desc.ns, lng)?.toLowerCase();
    }
    const name = this.names[lng];
    if (name?.includes(search)) {
      return true;
    }
    const keyword = this.keywords[lng];
    return keyword?.includes(search);
  }

  matchSearch(search: string): boolean {
    if (!search) {
      return true;
    }
    if (this.desc) {
      // check keywords from i18n
      if (i18next.language !== 'en') {
        if (this.matchKeywords(i18next.language, search)) {
          return true;
        }
      }
      if (this.matchKeywords('en', search)) {
        return true;
      }
    }

    return this.key.includes(search) || this.name.includes(search);
  }

  addToList(list: FunctionTreeItem[], search?: string) {
    if (this.matchSearch(search)) {
      list.push(this);
      if (this.opened === 'opened' && this.children) {
        for (const child of this.children) {
          child.addToList(list);
        }
      }
    } else if (search && this.children.length) {
      // check if there is any matched child
      const searchChildren: FunctionTreeItem[] = [];
      for (const child of this.children) {
        child.addToList(searchChildren, search);
      }

      const strongFilter = search.length > 1 || search.charCodeAt(0) > 128;

      if (searchChildren.length) {
        list.push(this);
        if (strongFilter) {
          this.opened = 'opened';
        }
        if (this.opened === 'opened') {
          for (const child of searchChildren) {
            list.push(child);
          }
        }
      } else if (strongFilter) {
        // close it if no child matches search
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
        const colonIndex = catKey.lastIndexOf(':', catKey.length - 2);
        if (colonIndex > -1) {
          const parentCateKey = catKey.substring(0, colonIndex);
          const parentCateName = parentCateKey.split(':').pop();
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
    const item = this.typeMap.get(key);
    if (item && item.desc) {
      // remove existing function first
      this.typeMap.delete(key);
      item.parent.removeChild(key);
    }

    if (desc) {
      if (desc.src === 'hidden') {
        return;
      }
      if (this.filter && !this.filter(desc)) {
        return;
      }
      let category = desc.category || desc.ns;
      if (category == null && desc.properties) {
        category = 'other'; // TODO remove other
      }
      const catKey = `${category}:`;

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
