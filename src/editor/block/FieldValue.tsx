import React from 'react';
import {Button, Icon} from 'antd';
import {LazyUpdateComponent, LazyUpdateSubscriber} from '../../ui/component/LazyUpdateComponent';
import {ClientConn} from '../../core/connect/ClientConn';
import {TRUNCATED} from '../../core/util/DataTypes';
import {encodeDisplay} from '../../core/util/Serialize';
import {displayNumber} from '../../ui/util/Types';
import {Popup} from '../component/ClickPopup';
import {ObjectTree} from '../../ui/object-tree/ObjectTree';

interface Props {
  conn: ClientConn;
  path: string;
}

export class FieldValue extends LazyUpdateComponent<Props, any> {
  valueSub = new LazyUpdateSubscriber(this);

  constructor(props: Props) {
    super(props);
    let {conn, path} = props;
    this.valueSub.subscribe(conn, path, false);
  }

  getObjectMenu = () => {
    let {conn, path} = this.props;
    let val = this.valueSub.value;
    return <ObjectTree conn={conn} path={path} data={val} style={{width: 300, height: 300}} />;
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
              <Popup
                popup={this.getObjectMenu}
                popupAlign={{
                  points: ['tl', 'tl'],
                  offset: [2, -3]
                }}
              >
                <div className="ticl-tree-arr ticl-tree-arr-expand" />
              </Popup>
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
    this.valueSub.unsubscribe();
    super.componentWillUnmount();
  }
}
