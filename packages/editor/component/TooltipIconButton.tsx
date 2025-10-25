import React from 'react';
import {Tooltip} from 'antd';
import {Button, ButtonProps} from '@blueprintjs/core';
import {TooltipPlacement} from 'antd/lib/tooltip';
import {ClientConn, ValueSubscriber} from '@ticlo/core/connect/ClientConn';
import {LazyUpdateComponent, LazyUpdateSubscriber} from './LazyUpdateComponent';
import {ValueUpdate} from '@ticlo/core/connect/ClientRequests';

interface Props extends ButtonProps {
  conn: ClientConn;
  path?: string;
  mapEnabled?: (value: any) => boolean;
  tooltip: React.ReactNode;
  tooltipPlacement?: TooltipPlacement;
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
    const {className, size, disabled: disabledProp, ...rest} = props;
    const effectiveClassName = className ? `ticl-icon-btn ${className}` : 'ticl-icon-btn';
    const effectiveSize = size ?? 'small';
    const effectiveDisabled = disabled || disabledProp;

    return (
      <Tooltip
        title={tooltip}
        mouseLeaveDelay={0}
        placement={tooltipPlacement}
        open={tooltipVisible && !effectiveDisabled}
        onOpenChange={this.onVisibleChange}
      >
        <Button className={effectiveClassName} size={effectiveSize} {...rest} disabled={effectiveDisabled} />
      </Tooltip>
    );
  }

  componentWillUnmount() {
    this.subscriber.unsubscribe();
    super.componentWillUnmount();
  }
}
