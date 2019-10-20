import React from 'react';
import {attributeList, ClientConn, ValueUpdate} from '../../core/client';
import {DataMap} from '../../core/util/DataTypes';
import {
  blankFuncDesc,
  configDescs,
  configList,
  FunctionDesc,
  PropDesc,
  PropGroupDesc
} from '../../core/block/Descriptor';
import {PropertyEditor} from './PropertyEditor';
import {GroupEditor} from './GroupEditor';
import {MultiSelectComponent, MultiSelectLoader} from './MultiSelectComponent';
import {ExpandIcon} from '../../ui/component/Tree';
import {deepEqual} from '../../core/util/Compare';
import {Button, Empty, Tooltip} from 'antd';
import {AddMorePropertyMenu} from './AddMoreProperty';
import {Popup} from '../component/ClickPopup';
import {BlockWidget} from '../block/view/BlockWidget';
import {LazyUpdateComponent, LazyUpdateSubscriber} from '../../ui/component/LazyUpdateComponent';

function descToEditor(conn: ClientConn, keys: string[], funcDesc: FunctionDesc, propDesc: PropDesc) {
  return (
    <PropertyEditor
      key={propDesc.name}
      name={propDesc.name}
      keys={keys}
      conn={conn}
      funcDesc={funcDesc}
      propDesc={propDesc}
    />
  );
}

class BlockLoader extends MultiSelectLoader<PropertyList> {
  isListener = {
    onUpdate: (response: ValueUpdate) => {
      this.conn.watchDesc(response.cache.value, this.onDesc);
    }
  };

  more: (PropDesc | PropGroupDesc)[];
  moreListener = {
    onUpdate: (response: ValueUpdate) => {
      let value = response.cache.value;
      if (!Array.isArray(value)) {
        value = null;
      }
      if (!deepEqual(value, this.more)) {
        this.more = value;
        this.parent.forceUpdate();
      }
    }
  };

  widget: string = null;
  widgetListener = {
    onUpdate: (response: ValueUpdate) => {
      let value = response.cache.value;
      if (typeof value !== 'string') {
        value = null;
      }
      if (this.widget !== value) {
        this.widget = value;
        this.parent.forceUpdate();
      }
    }
  };

  desc: FunctionDesc;
  onDesc = (desc: FunctionDesc) => {
    if (desc == null) {
      this.desc = blankFuncDesc;
    } else {
      this.desc = desc;
    }
    this.parent.forceUpdate();
  };

  init() {
    this.conn.subscribe(`${this.key}.#is`, this.isListener, true);
    this.conn.subscribe(`${this.key}.#more`, this.moreListener, true);
    this.conn.subscribe(`${this.key}.@b-widget`, this.widgetListener, true);
  }

  destroy() {
    this.conn.unsubscribe(`${this.key}.#is`, this.isListener);
    this.conn.unsubscribe(`${this.key}.#more`, this.moreListener);
    this.conn.unsubscribe(`${this.key}.@b-widget`, this.widgetListener);
    this.conn.unwatchDesc(this.onDesc);
  }
}

function getPropDescName(prop: PropDesc | PropGroupDesc) {
  if (prop.type === 'group') {
    return `${prop.name}#len`;
  } else if (prop.name) {
    return prop.name;
  }
  return '@invalid';
}

function comparePropDesc(a: PropDesc | PropGroupDesc, b: PropDesc | PropGroupDesc) {
  if (a.type === 'group') {
    if (a.name !== b.name) return false;
    if (
      !(a as PropGroupDesc).properties ||
      !(b as PropGroupDesc).properties ||
      (a as PropGroupDesc).properties.length !== (b as PropGroupDesc).properties.length
    ) {
      return false;
    }
    for (let i = 0; i < (a as PropGroupDesc).properties.length; ++i) {
      if (!comparePropDesc((a as PropGroupDesc).properties[i], (b as PropGroupDesc).properties[i])) {
        return false;
      }
    }
  } else {
    if (a.name !== b.name) return false;
    if ((a as PropDesc).type !== (b as PropDesc).type) return false;
  }

  return true;
}

interface Props {
  conn: ClientConn;
  keys: string[];
  style?: React.CSSProperties;

  // minimal is used when PropertyList is shown as popup, like in the ServiceEditor
  mode?: 'minimal' | 'subBlock';
}

interface State {
  showConfig: boolean;
  showAttribute: boolean;
  showMore: boolean;
  showAddMorePopup: boolean;
}

class PropertyDefMerger {
  map: Map<string, PropDesc | PropGroupDesc> = null;

  isNotEmpty() {
    return this.map && this.map.size > 0;
  }

  add(props: (PropDesc | PropGroupDesc)[]) {
    if (this.map) {
      // merge with existing propMap, only show properties exist in all desc
      let checkedProperties: Set<string> = new Set<string>();
      for (let prop of props) {
        let name = getPropDescName(prop);
        if (this.map.has(name) && !comparePropDesc(this.map.get(name), prop)) {
          // hide property if there is a conflict
          this.map.delete(name);
        } else {
          checkedProperties.add(name);
        }
      }
      for (let [name, prop] of this.map) {
        if (!checkedProperties.has(name)) {
          this.map.delete(name);
        }
      }
    } else {
      this.map = new Map<string, PropDesc | PropGroupDesc>();
      for (let prop of props) {
        let name = getPropDescName(prop);
        this.map.set(name, prop);
      }
    }
  }

  render(keys: string[], conn: ClientConn, funcDesc: FunctionDesc, isMore?: boolean) {
    let children: React.ReactNode[] = [];
    if (this.map) {
      for (let [name, prop] of this.map) {
        if (prop.type === 'group') {
          children.push(
            <GroupEditor
              key={name}
              keys={keys}
              conn={conn}
              isMore={isMore}
              funcDesc={funcDesc}
              groupDesc={prop as PropGroupDesc}
            />
          );
        } else if (prop.name) {
          children.push(
            <PropertyEditor
              key={name}
              name={name}
              keys={keys}
              conn={conn}
              isMore={isMore}
              funcDesc={funcDesc}
              propDesc={prop as PropDesc}
            />
          );
        }
      }
    }
    return children;
  }

  remove(name: string) {
    if (this.map) {
      this.map.delete(name);
    }
  }
}

export class PropertyList extends MultiSelectComponent<Props, State, BlockLoader> {
  constructor(props: Readonly<Props>) {
    super(props);
    this.state = {showConfig: false, showAttribute: false, showMore: true, showAddMorePopup: false};
    this.updateLoaders(props.keys);
  }

  createLoader(key: string) {
    return new BlockLoader(key, this);
  }

  onShowMoreClick = () => {
    this.setState({showMore: !this.state.showMore});
  };
  onShowConfigClick = () => {
    this.setState({showConfig: !this.state.showConfig});
  };
  onShowAttributeClick = () => {
    this.setState({showAttribute: !this.state.showAttribute});
  };
  onAddMorePopup = (visible: boolean) => {
    this.setState({showAddMorePopup: visible});
  };

  onAddMore = (desc: PropDesc | PropGroupDesc) => {
    let {conn} = this.props;
    for (let [key, subscriber] of this.loaders) {
      conn.addMoreProp(key, desc);
    }
    this.onAddMorePopup(false);
  };

  getConfigs(conn: ClientConn, keys: string[], funcDesc: FunctionDesc) {
    let configChildren = [];
    for (let configDesc of configList) {
      configChildren.push(descToEditor(conn, keys, funcDesc, configDesc));
    }
    return configChildren;
  }

  renderImpl() {
    let {conn, keys, style, mode} = this.props;
    let {showConfig, showAttribute, showMore, showAddMorePopup} = this.state;

    let descChecked: Set<string> = new Set<string>();
    let propMerger: PropertyDefMerger = new PropertyDefMerger();
    let moreMerger: PropertyDefMerger = new PropertyDefMerger();

    let isEmpty = true;
    for (let [key, subscriber] of this.loaders) {
      if (subscriber.desc) {
        isEmpty = false;
        break;
      }
    }
    if (isEmpty) {
      // nothing selected
      return (
        <div className="ticl-property-list" style={style}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      );
    }

    for (let [key, subscriber] of this.loaders) {
      if (subscriber.desc) {
        if (!descChecked.has(subscriber.desc.name)) {
          descChecked.add(subscriber.desc.name);
          propMerger.add(subscriber.desc.properties);
        }
      } else {
        // properties not ready
        propMerger.map = null;
        break;
      }
    }
    if (mode === 'subBlock') {
      propMerger.remove('output');
    }
    let funcDesc: FunctionDesc = this.loaders.entries().next().value[1].desc;
    if (!funcDesc) {
      funcDesc = blankFuncDesc;
    }
    let children = propMerger.render(keys, conn, funcDesc);

    if (mode !== 'minimal') {
      // merge #more properties
      let moreChildren: React.ReactNode[];
      for (let [key, subscriber] of this.loaders) {
        if (subscriber.more) {
          moreMerger.add(subscriber.more);
        } else {
          // properties not ready
          moreMerger.map = null;
          break;
        }
      }
      if (moreMerger.isNotEmpty() && showMore) {
        moreChildren = moreMerger.render(keys, conn, funcDesc, true);
      }

      let allowAttribute = mode == null && keys.length === 1;

      return (
        <div className="ticl-property-list" style={style}>
          <PropertyEditor name="#is" keys={keys} conn={conn} funcDesc={funcDesc} propDesc={configDescs['#is']} />
          <div className="ticl-property-divider">
            <div className="ticl-h-line" />
          </div>

          {children}

          <div className="ticl-property-divider">
            <div className="ticl-h-line" style={{maxWidth: '16px'}} />
            <ExpandIcon opened={showConfig ? 'opened' : 'closed'} onClick={this.onShowConfigClick} />
            <span>config</span>
            <div className="ticl-h-line" />
          </div>
          {showConfig ? this.getConfigs(conn, keys, funcDesc) : null}

          {allowAttribute ? (
            <div className="ticl-property-divider">
              <div className="ticl-h-line" style={{maxWidth: '16px'}} />
              <ExpandIcon opened={showAttribute ? 'opened' : 'closed'} onClick={this.onShowAttributeClick} />
              <span>block</span>
              <div className="ticl-h-line" />
            </div>
          ) : null}
          {allowAttribute && showAttribute ? (
            <PropertyAttributeList conn={conn} keys={keys} funcDesc={funcDesc} />
          ) : null}

          <div className="ticl-property-divider">
            <div className="ticl-h-line" style={{maxWidth: '16px'}} />
            {moreMerger.isNotEmpty() ? (
              <ExpandIcon opened={showMore ? 'opened' : 'closed'} onClick={this.onShowMoreClick} />
            ) : null}
            <span>more</span>
            <Popup
              popupVisible={showAddMorePopup}
              onPopupVisibleChange={this.onAddMorePopup}
              popup={<AddMorePropertyMenu onAddProperty={this.onAddMore} />}
            >
              <Button className="ticl-icon-btn" shape="circle" tabIndex={-1} icon="plus-square" />
            </Popup>

            <div className="ticl-h-line" />
          </div>
          {moreChildren}
        </div>
      );
    } else {
      return (
        <div className="ticl-property-list" style={style}>
          <PropertyEditor
            name="#is"
            keys={keys}
            conn={conn}
            funcDesc={funcDesc}
            propDesc={configDescs['#is(readonly)']}
          />
          <div className="ticl-property-divider">
            <div className="ticl-h-line" />
          </div>

          {children}
        </div>
      );
    }
  }
}

interface PropertyAttributeProps {
  conn: ClientConn;
  keys: string[];
  funcDesc: FunctionDesc;
}

class PropertyAttributeList extends LazyUpdateComponent<PropertyAttributeProps, any> {
  widgetListener = new LazyUpdateSubscriber(this);

  updateKeys(keys: string[]) {
    const {conn} = this.props;
    this.widgetListener.subscribe(conn, `${keys[0]}.@b-widget`);
  }

  constructor(props: PropertyAttributeProps) {
    super(props);
    this.updateKeys(props.keys);
  }

  shouldComponentUpdate(nextProps: Readonly<PropertyAttributeProps>, nextState: Readonly<any>): boolean {
    this.updateKeys(nextProps.keys);
    return super.shouldComponentUpdate(nextProps, nextState);
  }

  renderImpl() {
    let {conn, keys, funcDesc} = this.props;
    let attributeChildren = [];
    for (let attributeDesc of attributeList) {
      attributeChildren.push(descToEditor(conn, keys, funcDesc, attributeDesc));
    }
    attributeChildren.push(descToEditor(conn, keys, funcDesc, BlockWidget.widgetDesc));
    let widget = BlockWidget.get(this.widgetListener.value);
    if (widget) {
      for (let propDesc of widget.viewProperties) {
        attributeChildren.push(descToEditor(conn, keys, funcDesc, propDesc as PropDesc));
      }
    }
    return attributeChildren;
  }
  componentWillUnmount() {
    this.widgetListener.unsubscribe();
    super.componentWillUnmount();
  }
}
