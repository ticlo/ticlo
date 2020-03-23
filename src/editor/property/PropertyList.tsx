import React from 'react';
import {Button, Empty, Tooltip} from 'antd';
import PlusSquareIcon from '@ant-design/icons/PlusSquareOutlined';
import {
  attributeList,
  ClientConn,
  ValueSubscriber,
  ValueUpdate,
  blankFuncDesc,
  configDescs,
  configList,
  FunctionDesc,
  PropDesc,
  PropGroupDesc,
  deepEqual,
  mapConfigDesc,
} from '../../../src/core/editor';
import {PropertyEditor} from './PropertyEditor';
import {GroupEditor} from './GroupEditor';
import {MultiSelectComponent, MultiSelectLoader} from './MultiSelectComponent';
import {ExpandIcon, ExpandState} from '../component/Tree';
import {AddCustomPropertyMenu} from './AddCustomProperty';
import {Popup} from '../component/ClickPopup';
import {BlockWidget} from '../block/view/BlockWidget';
import {LazyUpdateComponent, LazyUpdateSubscriber} from '../component/LazyUpdateComponent';
import {OptionalPropertyList} from './OptionalPropertyList';
import {CustomPropertyReorder} from './PropertyReorder';

function descToEditor(conn: ClientConn, paths: string[], funcDesc: FunctionDesc, propDesc: PropDesc) {
  return (
    <PropertyEditor
      key={propDesc.name}
      name={propDesc.name}
      paths={paths}
      conn={conn}
      funcDesc={funcDesc}
      propDesc={propDesc}
    />
  );
}

class BlockLoader extends MultiSelectLoader<PropertyList> {
  isListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      this.conn.watchDesc(response.cache.value, this.onDesc);
    },
  });

  custom: (PropDesc | PropGroupDesc)[];
  customListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      let value = response.cache.value;
      if (!Array.isArray(value)) {
        value = null;
      }
      if (!deepEqual(value, this.custom)) {
        this.custom = value;
        this.parent.forceUpdate();
      }
    },
  });

  widget: string = null;
  widgetListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      let value = response.cache.value;
      if (typeof value !== 'string') {
        value = null;
      }
      if (this.widget !== value) {
        this.widget = value;
        this.parent.forceUpdate();
      }
    },
  });

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
    this.isListener.subscribe(this.conn, `${this.path}.#is`, true);
    this.customListener.subscribe(this.conn, `${this.path}.#custom`, true);
    this.widgetListener.subscribe(this.conn, `${this.path}.@b-widget`, true);
  }

  destroy() {
    this.isListener.unsubscribe();
    this.customListener.unsubscribe();
    this.widgetListener.unsubscribe();
    this.conn.unwatchDesc(this.onDesc);
  }
}

function getPropDescName(prop: PropDesc | PropGroupDesc) {
  if (prop.type === 'group') {
    return `${prop.name}[]`;
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
  paths: string[];
  style?: React.CSSProperties;

  // minimal is used when PropertyList is shown as popup, like in the ServiceEditor
  mode?: 'minimal' | 'subBlock';
}

interface State {
  showConfig: boolean;
  showAttribute: boolean;
  showCustom: boolean;
  showAddCustomPopup: boolean;
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

  render(paths: string[], conn: ClientConn, funcDesc: FunctionDesc, isCustom?: boolean) {
    let children: React.ReactNode[] = [];
    if (this.map) {
      for (let [name, prop] of this.map) {
        if (prop.type === 'group') {
          children.push(
            <GroupEditor
              key={name}
              paths={paths}
              conn={conn}
              isCustom={isCustom}
              funcDesc={funcDesc}
              groupDesc={prop as PropGroupDesc}
            />
          );
        } else if (prop.name) {
          children.push(
            <PropertyEditor
              key={name}
              name={name}
              paths={paths}
              conn={conn}
              isCustom={isCustom}
              funcDesc={funcDesc}
              propDesc={prop as PropDesc}
              reorder={isCustom ? CustomPropertyReorder : null}
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
    this.state = {showConfig: false, showAttribute: false, showCustom: true, showAddCustomPopup: false};
    this.updateLoaders(props.paths);
  }

  createLoader(path: string) {
    return new BlockLoader(path, this);
  }

  onShowCustomClick = () => {
    this.safeSetState({showCustom: !this.state.showCustom});
  };
  onShowConfigClick = () => {
    this.safeSetState({showConfig: !this.state.showConfig});
  };
  onShowAttributeClick = () => {
    this.safeSetState({showAttribute: !this.state.showAttribute});
  };
  onAddCustomPopup = (visible: boolean) => {
    this.safeSetState({showAddCustomPopup: visible});
  };

  onAddCustom = (desc: PropDesc | PropGroupDesc) => {
    let {conn} = this.props;
    for (let [path, subscriber] of this.loaders) {
      conn.addCustomProp(path, desc);
    }
    this.onAddCustomPopup(false);
  };

  renderImpl() {
    let {conn, paths, style, mode} = this.props;
    let {showConfig, showAttribute, showCustom, showAddCustomPopup} = this.state;

    let descChecked: Set<string> = new Set<string>();
    let propMerger: PropertyDefMerger = new PropertyDefMerger();
    let configMerger: PropertyDefMerger = new PropertyDefMerger();
    let customMerger: PropertyDefMerger = new PropertyDefMerger();

    let isEmpty = true;
    let optionalDescs = new Set<FunctionDesc>();
    for (let [path, subscriber] of this.loaders) {
      let desc = subscriber.desc;
      if (desc) {
        if (isEmpty) {
          isEmpty = false;
        }
        if (optionalDescs) {
          if (desc.optional) {
            optionalDescs.add(desc);
          } else if (desc.base && (desc = conn.watchDesc(desc.base)) /*set value and convert to bool*/) {
            optionalDescs.add(desc);
          } else {
            // no need for optioanl properties
            optionalDescs = null;
          }
        }
      } else {
        isEmpty = true;
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

    let baseDesc = conn.getCommonBaseFunc(optionalDescs);
    for (let [path, subscriber] of this.loaders) {
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
      propMerger.remove('#output');
    }
    let firstLoader: BlockLoader = this.loaders.entries().next().value[1];
    let funcDesc = firstLoader.desc;
    if (!funcDesc) {
      funcDesc = blankFuncDesc;
    }
    let children = propMerger.render(paths, conn, funcDesc);

    if (mode !== 'minimal') {
      // merge #config properties

      let configChildren: React.ReactNode[];
      if (showConfig) {
        for (let [path, subscriber] of this.loaders) {
          if (subscriber.desc) {
            configMerger.add(mapConfigDesc(subscriber.desc.configs) || configList);
          } else {
            // properties not ready
            configMerger.map = null;
            break;
          }
        }
        if (configMerger.isNotEmpty()) {
          configChildren = configMerger.render(paths, conn, funcDesc, true);
        }
      }

      // merge #custom properties
      let customChildren: React.ReactNode[];
      for (let [path, subscriber] of this.loaders) {
        if (subscriber.custom) {
          customMerger.add(subscriber.custom);
        } else {
          // properties not ready
          customMerger.map = null;
          break;
        }
      }
      if (customMerger.isNotEmpty() && showCustom) {
        customChildren = customMerger.render(paths, conn, funcDesc, true);
      }

      let allowAttribute = mode == null && paths.length === 1;

      let customExpand: ExpandState = 'empty';
      if (customMerger.isNotEmpty()) {
        customExpand = showCustom ? 'opened' : 'closed';
      }
      return (
        <div className="ticl-property-list" style={style}>
          <PropertyEditor name="#is" paths={paths} conn={conn} funcDesc={funcDesc} propDesc={configDescs['#is']} />

          {children.length ? (
            <div className="ticl-property-divider">
              <div className="ticl-h-line" />
            </div>
          ) : null}
          {children}

          {baseDesc ? <OptionalPropertyList conn={conn} paths={paths} funcDesc={baseDesc} /> : null}

          <div className="ticl-property-divider">
            <div className="ticl-h-line" style={{maxWidth: '16px'}} />
            <ExpandIcon opened={showConfig ? 'opened' : 'closed'} onClick={this.onShowConfigClick} />
            <span>config</span>
            <div className="ticl-h-line" />
          </div>
          {configChildren}

          {allowAttribute ? (
            <div className="ticl-property-divider">
              <div className="ticl-h-line" style={{maxWidth: '16px'}} />
              <ExpandIcon opened={showAttribute ? 'opened' : 'closed'} onClick={this.onShowAttributeClick} />
              <span>block</span>
              <div className="ticl-h-line" />
            </div>
          ) : null}
          {allowAttribute && showAttribute ? (
            <PropertyAttributeList conn={conn} paths={paths} funcDesc={funcDesc} />
          ) : null}

          <div className="ticl-property-divider">
            <div className="ticl-h-line" style={{maxWidth: '16px'}} />
            <ExpandIcon opened={customExpand} onClick={this.onShowCustomClick} />
            <span>custom</span>
            <Popup
              popupVisible={showAddCustomPopup}
              onPopupVisibleChange={this.onAddCustomPopup}
              popup={<AddCustomPropertyMenu conn={conn} onAddProperty={this.onAddCustom} />}
            >
              <Button className="ticl-icon-btn" shape="circle" tabIndex={-1} icon={<PlusSquareIcon />} />
            </Popup>

            <div className="ticl-h-line" />
          </div>
          {customChildren}
        </div>
      );
    } else {
      // minimal block used by Service Editor
      return (
        <div className="ticl-property-list" style={style}>
          <PropertyEditor
            name="#is"
            paths={paths}
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
  paths: string[];
  funcDesc: FunctionDesc;
}

class PropertyAttributeList extends LazyUpdateComponent<PropertyAttributeProps, any> {
  widgetListener = new LazyUpdateSubscriber(this);

  _subscribingPath: string;
  updatePaths(paths: string[]) {
    if (paths[0] === this._subscribingPath) {
      return;
    }
    this._subscribingPath = paths[0];
    const {conn} = this.props;
    this.widgetListener.subscribe(conn, `${this._subscribingPath}.@b-widget`);
  }

  constructor(props: PropertyAttributeProps) {
    super(props);
    this.updatePaths(props.paths);
  }

  renderImpl() {
    let {conn, paths, funcDesc} = this.props;
    this.updatePaths(paths);

    let attributeChildren = [];
    for (let attributeDesc of attributeList) {
      attributeChildren.push(descToEditor(conn, paths, funcDesc, attributeDesc));
    }
    attributeChildren.push(descToEditor(conn, paths, funcDesc, BlockWidget.widgetDesc));
    let widget = BlockWidget.get(this.widgetListener.value);
    if (widget) {
      for (let propDesc of widget.viewProperties) {
        attributeChildren.push(descToEditor(conn, paths, funcDesc, propDesc as PropDesc));
      }
    }
    return attributeChildren;
  }
  componentWillUnmount() {
    this.widgetListener.unsubscribe();
    super.componentWillUnmount();
  }
}
