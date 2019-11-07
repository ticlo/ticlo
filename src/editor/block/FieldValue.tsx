import React from 'react';
import {Button, Icon} from 'antd';
import {LazyUpdateComponent, LazyUpdateSubscriber} from '../../ui/component/LazyUpdateComponent';
import {ClientConn} from '../../core/connect/ClientConn';
import {TRUNCATED} from '../../core/util/DataTypes';
import {encodeDisplay} from '../../core/util/Serialize';
import {displayNumber} from '../../ui/util/Types';
import {Popup} from '../component/ClickPopup';
import {ObjectTree} from '../object-tree/ObjectTree';
import {ObjectTreePanel} from '../../panel/object-tree/ObjectTreePanel';
import {TicloLayoutContext, TicloLayoutContextType} from '../component/LayoutContext';

interface Props {
  conn: ClientConn;
  path: string;
}

export class FieldValue extends LazyUpdateComponent<Props, any> {
  static contextType = TicloLayoutContextType;
  context!: TicloLayoutContext;

  valueSub = new LazyUpdateSubscriber(this);

  constructor(props: Props) {
    super(props);
    let {conn, path} = props;
    this.valueSub.subscribe(conn, path, false);
  }
  getObjectMenu = () => {
    let {conn, path} = this.props;
    let val = this.valueSub.value;
    return <ObjectTree conn={conn} path={path} data={val} />;
  };
  objectTreeShown = false;
  onExpandObjectTree = (e: React.MouseEvent) => {
    let {path} = this.props;
    let val = this.valueSub.value;
    this.context.showObjectTree(path, val, e.target as HTMLElement, this);
    this.objectTreeShown = true;
  };

  renderImpl() {
    let {conn, path} = this.props;
    let child: React.ReactNode;
    let val = this.valueSub.value;
    switch (typeof val) {
      case 'string':
        if (val.length > 512) {
          val = `${val.substr(0, 128)}${TRUNCATED}`;
        }
        child = <span className="ticl-string-value">{val}</span>;
        break;
      case 'object':
        child = encodeDisplay(val);
        if (val && (Array.isArray(val) || val.constructor === Object)) {
          child = (
            <>
              <div className="ticl-object-value">{child}</div>
              {this.context && this.context.showObjectTree ? (
                // use float panel if possible
                <div className="ticl-tree-arr ticl-tree-arr-expand" onClick={this.onExpandObjectTree} />
              ) : (
                // show as popup menu
                <Popup
                  popup={this.getObjectMenu}
                  popupAlign={{
                    points: ['tl', 'tr'],
                    offset: [-6, 0]
                  }}
                >
                  <div className="ticl-tree-arr ticl-tree-arr-expand" />
                </Popup>
              )}
            </>
          );
        }
        break;
      case 'number':
        child = displayNumber(val);
        break;
      case 'undefined':
        break;
      default:
        child = `${val}`;
    }
    return <div className="ticl-field-value">{child}</div>;
  }

  componentWillUnmount(): void {
    if (this.objectTreeShown && this.context && this.context.closeObjectTree) {
      let {path} = this.props;
      this.context.closeObjectTree(path, this);
    }
    this.valueSub.unsubscribe();
    super.componentWillUnmount();
  }
}
