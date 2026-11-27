import React from 'react';
import {Button, message} from 'antd';
import type {PropDesc} from '@ticlo/core';
import {BlockWidget, type BlockWidgetProps} from './BlockWidget.ts';
import {EditPolicyContext} from '../../component/EditPolicyContext.tsx';
import {LazyUpdateComponent, LazyUpdateSubscriber} from '../../component/LazyUpdateComponent.tsx';
import {t} from '../../component/LocalizedLabel.tsx';

class WebAuthorizationWidget extends LazyUpdateComponent<BlockWidgetProps, object> {
  static contextType = EditPolicyContext;
  declare context: React.ContextType<typeof EditPolicyContext>;
  static readonly viewProperties: PropDesc[] = [{name: '@b-w-label', type: 'string'}];

  label = new LazyUpdateSubscriber(this);
  #opening: Window | undefined;

  constructor(props: BlockWidgetProps) {
    super(props);
    const {conn, path, updateViewHeight} = props;
    this.label.subscribe(conn, `${path}.@b-w-label`);
    updateViewHeight(48);
  }

  canStart() {
    return this.context.can({cmd: 'executeCommand', path: this.props.path, command: 'startAuthorization'});
  }

  start = async () => {
    if (this.#opening || !this.canStart()) return;
    // Open within the click gesture, before waiting for the remote command.
    const popup = window.open('about:blank', '_blank', 'popup,width=520,height=680');
    if (!popup) {
      message.error(t('Authorization popup blocked'));
      return;
    }
    popup.opener = null;
    this.#opening = popup;
    this.forceUpdate();
    const {conn, path} = this.props;
    try {
      const response = await conn.executeCommand(path, 'startAuthorization');
      if (popup.closed || conn !== this.props.conn || path !== this.props.path) {
        popup.close();
        return;
      }
      const value = response?.result?.url;
      if (value === undefined) {
        popup.close();
        message.error(t('Authorization URL missing'));
        return;
      }
      const url = typeof value === 'string' && URL.canParse(value) ? new URL(value) : undefined;
      if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) {
        popup.close();
        message.error(t('Invalid authorization URL'));
        return;
      }
      popup.location.replace(url.href);
    } catch (error) {
      if (!popup.closed) {
        popup.close();
        message.error(error instanceof Error ? error.message : String(error));
      }
    } finally {
      this.#opening = undefined;
      if (this._mounted) this.forceUpdate();
    }
  };

  renderImpl(): React.ReactNode {
    return (
      <div className="ticl-e-button-view">
        <Button block disabled={!this.canStart()} loading={!!this.#opening} onClick={this.start}>
          {this.label.value ?? t('Authorize')}
        </Button>
      </div>
    );
  }

  componentWillUnmount() {
    this.#opening?.close();
    this.label.unsubscribe();
    super.componentWillUnmount();
  }
}

BlockWidget.register('web-authorization', WebAuthorizationWidget);
