import {LazyUpdateComponent, LazyUpdateSubscriber} from '../../ui/component/LazyUpdateComponent';
import React from 'react';
import {ClientConn} from '../../core/connect/ClientConn';
import {TRUNCATED} from '../../core/util/DataTypes';
import {encodeDisplay} from '../../core/util/Serialize';
import {displayNumber} from '../../ui/util/Types';

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
  renderImpl() {
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
        break;
      case 'number':
        child = displayNumber(val);
        break;
      case 'undefined':
        break;
      default:
        child = `${val}`;
    }
    return <div className="ticl-field-value"> {child}</div>;
  }

  componentWillUnmount(): void {
    this.valueSub.unsubscribe();
    super.componentWillUnmount();
  }
}
