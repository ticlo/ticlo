import React from 'react';
import {Button, Tooltip} from 'antd';
import {ButtonProps} from 'antd';
import type {TooltipProps} from 'antd';
import {ClientConn, ValueSubscriber} from '@ticlo/core/connect/ClientConn.js';
import {LazyUpdateComponent, LazyUpdateSubscriber} from './LazyUpdateComponent.js';
import {ValueUpdate} from '@ticlo/core/connect/ClientRequests.js';

interface Props extends ButtonProps {
  conn: ClientConn;
  path?: string;
  mapEnabled?: (value: any) => boolean;
  tooltip: React.ReactNode;
  tooltipPlacement?: TooltipProps['placement'];
}

interface State {
  disabled: boolean;
  tooltipVisible: boolean;
}

export class TooltipIconButton extends LazyUpdateComponent<Props, any> {
  state: State = {tooltipVisible: false, disabled: false};

  constructor(props: Props) {
    super(props);
    let {conn, path} = props;
    if (path) {
      this.subscriber.subscribe(conn, path);
    }
  }
  subscriber = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      let {mapEnabled} = this.props;
      if (!mapEnabled) {
        mapEnabled = Boolean;
      }
      let enabled = mapEnabled(response.cache.value);
      if (enabled) {
        this.safeSetState({disabled: false});
      } else {
        this.safeSetState({disabled: true, tooltipVisible: false});
      }
    },
  });

  onVisibleChange = (visible: boolean) => {
    this.safeSetState({tooltipVisible: visible});
  };

  renderImpl() {
    let {conn, path, mapEnabled, tooltip, tooltipPlacement, ...props} = this.props;
    let {disabled, tooltipVisible} = this.state;

    return (
      <Tooltip
        title={tooltip}
        mouseLeaveDelay={0}
        placement={tooltipPlacement}
        open={tooltipVisible}
        onOpenChange={this.onVisibleChange}
      >
        <Button shape="circle" size="small" {...props} disabled={disabled} />
      </Tooltip>
    );
  }

  componentWillUnmount() {
    this.subscriber.unsubscribe();
    super.componentWillUnmount();
  }
}
