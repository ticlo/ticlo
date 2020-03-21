import React from 'react';
import {ClientConn} from '../../../src/core/connect/ClientConn';
import {ButtonProps} from 'antd/lib/button';
import {Button} from 'antd';
import {LazyUpdateComponent, LazyUpdateSubscriber} from './LazyUpdateComponent';

interface Props extends ButtonProps {
  conn: ClientConn;
  path: string;
  mapEnabled?: (value: any) => boolean;
}

export class AutoDisableButton extends LazyUpdateComponent<Props, any> {
  subscriber: LazyUpdateSubscriber;
  constructor(props: Props) {
    super(props);
    this.subscriber = new LazyUpdateSubscriber(this);
  }
  renderImpl() {
    let {conn, path, mapEnabled, ...props} = this.props;
    if (!mapEnabled) {
      mapEnabled = Boolean;
    }
    let enabled = mapEnabled(this.subscriber.value);
    return <Button {...props} disabled={!enabled} />;
  }
  componentDidMount(): void {
    let {conn, path} = this.props;
    this.subscriber.subscribe(conn, path);
  }

  componentWillUnmount() {
    this.subscriber.unsubscribe();
  }
}
