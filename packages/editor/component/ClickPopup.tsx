import React, {useContext} from 'react';
import {ConfigProvider} from 'antd';
import Trigger_, {type TriggerProps} from 'rc-trigger';
const Trigger = (Trigger_ as any).default || Trigger_;
import {RightOutlined} from '@ant-design/icons';
import {useThemeScope} from './useThemeScope.ts';

function ThemedTrigger(props: TriggerProps) {
  const {getPopupContainer} = useContext(ConfigProvider.ConfigContext);
  const scope = useThemeScope();
  return <Trigger {...props} getPopupContainer={getPopupContainer} popupClassName={scope} />;
}

type ItemEventHandler = (event: 'show' | 'hide' | 'hover' | 'close') => void;

interface SubMenuItemProps {
  popup?: React.ReactElement | (() => React.ReactElement);
  popupVisible?: boolean;
  onItemEvent?: ItemEventHandler;

  children?: React.ReactNode;
}

interface SubMenuItemState {
  showPopup: boolean;
  hovered: boolean;
}

export class SubMenuItem extends React.PureComponent<SubMenuItemProps, SubMenuItemState> {
  state = {showPopup: false, hovered: false};

  showPopup = (visible: boolean) => {
    const {onItemEvent} = this.props;
    if (onItemEvent) {
      onItemEvent(visible ? 'show' : 'hide');
    } else {
      this.setState({showPopup: visible});
    }
  };
  onHover = (e: React.MouseEvent) => {
    this.props.onItemEvent('hover');
  };

  render() {
    let {showPopup} = this.state;
    const {popupVisible} = this.props;
    if (typeof popupVisible === 'boolean') {
      showPopup = popupVisible;
    }

    const {children, popup} = this.props;

    let cls = 'ticl-e-dropdown-menu-item';
    if (showPopup) {
      cls += ' ticl-e-dropdown-menu-item-active';
    }
    return (
      <ThemedTrigger
        action={['click']}
        popupAlign={{
          points: ['tl', 'tr'],
          offset: [3, 0],
          overflow: {adjustX: true, adjustY: true},
        }}
        prefixCls="ticl-e-dropdown"
        popupVisible={showPopup}
        onPopupVisibleChange={this.showPopup}
        popup={popup}
      >
        <div className={cls} onMouseOver={this.onHover}>
          {children}
          {popup ? <RightOutlined /> : null}
        </div>
      </ThemedTrigger>
    );
  }
}

interface MenuItemProps {
  onItemEvent?: ItemEventHandler;
  onClick?: (value: any) => void | boolean;
  value?: any;

  children?: React.ReactNode;
}

interface MenuItemState {}

export class MenuItem extends React.PureComponent<MenuItemProps, MenuItemState> {
  onHover = (e: React.MouseEvent) => {
    this.props.onItemEvent('hover');
  };
  onClick = (e: React.MouseEvent) => {
    const {onClick, value, onItemEvent} = this.props;
    if (onClick && onClick(value) !== true) {
      onItemEvent('close');
    }
  };

  render() {
    const {children} = this.props;
    return (
      <div className="ticl-e-dropdown-menu-item" onMouseOver={this.onHover} onClick={this.onClick}>
        {children}
      </div>
    );
  }
}

interface MenuProps {
  children?: React.ReactElement[];
  closeMenu?: () => void;
}

interface MenuState {
  subMenuKey: string;
}

export class Menu extends React.PureComponent<MenuProps, MenuState> {
  state: MenuState = {subMenuKey: null};

  _visibleCallbackMap: Map<string, ItemEventHandler> = new Map();

  _getVisibleCallback(key: string) {
    if (this._visibleCallbackMap.has(key)) {
      return this._visibleCallbackMap.get(key);
    }
    const callback = (event: 'show' | 'hide' | 'hover' | 'close') => {
      switch (event) {
        case 'show':
          this.setState({subMenuKey: key});
          break;
        case 'hide':
          if (key === this.state.subMenuKey) {
            this.setState({subMenuKey: null});
          }
          break;
        case 'hover':
          if (key !== this.state.subMenuKey) {
            this.setState({subMenuKey: null});
          }
          break;
        case 'close':
          this.props.closeMenu?.();
          break;
      }
    };
    this._visibleCallbackMap.set(key, callback);
    return callback;
  }

  render() {
    const {children} = this.props;
    const {subMenuKey} = this.state;

    const menuItems: React.ReactElement[] = [];
    if (children) {
      for (let i = 0; i < children.length; ++i) {
        const child = children[i];
        if (!child) continue;
        const element = child as React.ReactElement;
        if (element.type === SubMenuItem) {
          menuItems.push(
            React.cloneElement(element as React.ReactElement<SubMenuItemProps>, {
              popupVisible: element.key === subMenuKey,
              onItemEvent: this._getVisibleCallback(element.key as string),
            })
          );
        } else if (element.type === MenuItem) {
          menuItems.push(
            React.cloneElement(element as React.ReactElement<MenuItemProps>, {
              key: element.key ?? `${i}`,
              onItemEvent: this._getVisibleCallback(element.key as string),
            })
          );
        } else {
          menuItems.push(
            <MenuItem key={`${i}`} onItemEvent={this._getVisibleCallback(element.key as string)}>
              {child}
            </MenuItem>
          );
        }
      }
    }

    return <div className="ant-dropdown-menu">{menuItems}</div>;
  }
}

interface PopupProps {
  children: React.ReactElement;
  popup: React.ReactElement | (() => React.ReactElement);

  trigger?: ('click' | 'hover' | 'contextMenu')[];

  popupVisible?: boolean;
  onPopupVisibleChange?: (visible: boolean) => void;
  popupAlign?: any;
}

interface PopupState {
  showPopup: boolean;
}

export class Popup extends React.PureComponent<PopupProps, PopupState> {
  state = {showPopup: false};

  requestContextMenu?: () => void;
  cancelContextMenu?: () => void;

  popupVisibleChange = (visible: boolean) => {
    if (visible && this.requestContextMenu) {
      this.requestContextMenu();
      return;
    }
    const {onPopupVisibleChange} = this.props;
    if (onPopupVisibleChange) {
      onPopupVisibleChange(visible);
    } else {
      this.setState({showPopup: visible});
    }
  };
  hidePopup = () => {
    this.popupVisibleChange(false);
  };

  onContextMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 2) return;
    this.cancelContextMenu?.();
    this.hidePopup();
    const doc = e.currentTarget.ownerDocument;
    const win = doc.defaultView;
    const {clientX, clientY} = e;
    let moved = false;
    let requested = false;
    let timeout: ReturnType<typeof setTimeout>;
    this.requestContextMenu = () => {
      requested = true;
    };
    const onMove = (event: MouseEvent) => {
      if (event.clientX !== clientX || event.clientY !== clientY) moved = true;
    };
    const onContextMenu = (event: MouseEvent) => {
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') moved = true;
    };
    const stopTracking = () => {
      this.requestContextMenu = undefined;
      doc.removeEventListener('mousemove', onMove, true);
      doc.removeEventListener('mouseup', onUp, true);
      doc.removeEventListener('keydown', onKeyDown, true);
      win?.removeEventListener('blur', cancel);
    };
    const cancel = () => {
      stopTracking();
      clearTimeout(timeout);
      doc.removeEventListener('contextmenu', onContextMenu, true);
      this.cancelContextMenu = undefined;
    };
    const onUp = (event: MouseEvent) => {
      if (event.button !== 2) return;
      onMove(event);
      stopTracking();
      // A native contextmenu can follow mouseup, including on a different drop target.
      timeout = setTimeout(cancel, 0);
      if (!moved && requested) this.popupVisibleChange(true);
    };
    this.cancelContextMenu = cancel;
    doc.addEventListener('mousemove', onMove, true);
    doc.addEventListener('mouseup', onUp, true);
    doc.addEventListener('contextmenu', onContextMenu, true);
    doc.addEventListener('keydown', onKeyDown, true);
    win?.addEventListener('blur', cancel);
  };

  onBodyKeydown: (e: KeyboardEvent) => void;

  fixMenu(element: React.ReactElement): React.ReactElement {
    if (element?.type === Menu) {
      return React.cloneElement(element as React.ReactElement<MenuProps>, {closeMenu: this.hidePopup});
    }
    return element;
  }

  render() {
    let {showPopup} = this.state;
    let {trigger, popupVisible, popupAlign} = this.props;
    if (typeof popupVisible === 'boolean') {
      showPopup = popupVisible;
    }

    if (showPopup && !this.onBodyKeydown) {
      this.onBodyKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          this.hidePopup();
          document.body.removeEventListener('keydown', this.onBodyKeydown);
          this.onBodyKeydown = null;
        }
      };
      document.body.addEventListener('keydown', this.onBodyKeydown);
    }

    if (!trigger) {
      trigger = ['click'];
    }
    if (!popupAlign) {
      popupAlign = {
        points: ['tl', 'bl'],
        offset: [0, 3],
        overflow: {adjustX: true, adjustY: true},
      };
    } else if (!popupAlign.overflow) {
      popupAlign.overflow = {adjustX: true, adjustY: true};
    }
    const builtinPlacements = {
      topLeft: {points: ['tl', 'tl']},
    };
    let alignPoint: boolean;
    if (trigger[0] === 'contextMenu') {
      popupAlign = {overflow: {adjustX: true, adjustY: true}};
      alignPoint = true;
    }

    const {children, popup} = this.props;
    let child = children;
    if (trigger.includes('contextMenu')) {
      const element = children as React.ReactElement<React.HTMLAttributes<HTMLElement>>;
      child = React.cloneElement(element, {
        onMouseDownCapture: (e) => {
          this.onContextMouseDown(e);
          element.props.onMouseDownCapture?.(e);
        },
      });
    }

    let fixedPopup: React.ReactElement | (() => React.ReactElement);
    if (typeof popup === 'function') {
      fixedPopup = () => this.fixMenu((popup as Function)());
    } else {
      fixedPopup = this.fixMenu(popup);
    }

    return (
      <ThemedTrigger
        action={trigger}
        popupAlign={popupAlign}
        alignPoint={alignPoint}
        popupPlacement="topLeft"
        builtinPlacements={builtinPlacements}
        prefixCls="ticl-e-dropdown"
        popupVisible={showPopup && !!fixedPopup}
        onPopupVisibleChange={this.popupVisibleChange}
        popup={fixedPopup}
      >
        {child}
      </ThemedTrigger>
    );
  }

  componentWillUnmount(): void {
    this.cancelContextMenu?.();
    if (this.onBodyKeydown) {
      document.body.removeEventListener('keydown', this.onBodyKeydown);
      this.onBodyKeydown = null;
    }
  }
}
