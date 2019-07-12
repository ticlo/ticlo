import React from "react";
import Trigger from "rc-trigger";
import {AddMorePropertyMenu} from "../property/AddMoreProperty";
import {Icon} from "antd";

type ItemEventHandler = (event: 'show' | 'hide' | 'hover') => void;

interface SubMenuItemProps {
  popup?: React.ReactElement | (() => React.ReactElement);

  popupVisible?: boolean;
  onItemEvent?: ItemEventHandler;
}

interface SubMenuItemState {
  showPopup: boolean;
  hovered: boolean;
}

export class SubMenuItem extends React.PureComponent<SubMenuItemProps, SubMenuItemState> {
  state = {showPopup: false, hovered: false};

  showPopup = (visible: boolean) => {
    let {onItemEvent} = this.props;
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
    let {popupVisible} = this.props;
    if (typeof popupVisible === 'boolean') {
      showPopup = popupVisible;
    }

    let {children, popup} = this.props;

    let cls = 'ticl-popup-menu-item';
    if (showPopup) {
      cls += ' ticl-popup-menu-item-active';
    }
    return (
      <Trigger action={['click']}
               popupAlign={{
                 points: ['tl', 'tr'],
                 offset: [3, 0],
                 overflow: {adjustX: true, adjustY: true}
               }}
               prefixCls='ant-select-dropdown'
               popupVisible={showPopup}
               onPopupVisibleChange={this.showPopup}
               popup={popup}>
        <div className={cls} onMouseOver={this.onHover}>
          {children}
          {popup
            ? <Icon type='right'/>
            : null
          }
        </div>
      </Trigger>
    );
  }
}


interface MenuItemProps {
  onItemEvent?: ItemEventHandler;
}

interface MenuItemState {

}

export class MenuItem extends React.PureComponent<MenuItemProps, MenuItemState> {
  onHover = (e: React.MouseEvent) => {
    this.props.onItemEvent('hover');
  };

  render() {
    let {children} = this.props;
    return (
      <div className='ticl-popup-menu-item' onMouseOver={this.onHover}>
        {children}
      </div>
    );
  }
}


interface MenuProps {
  children?: React.ReactElement[];
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
    let callback = (event: 'show' | 'hide' | 'hover') => {
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
      }
    };
    this._visibleCallbackMap.set(key, callback);
    return callback;
  }

  render() {

    let {children} = this.props;
    let {subMenuKey} = this.state;

    let menuItems: React.ReactElement[] = [];
    if (children) {
      for (let i = 0; i < children.length; ++i) {
        let child = children[i];
        if (!child) continue;
        let element = child as React.ReactElement;
        if (element.type === SubMenuItem) {
          menuItems.push(React.cloneElement(element, {
            popupVisible: element.key === subMenuKey,
            onItemEvent: this._getVisibleCallback(element.key as string)
          }));
        } else {
          menuItems.push(
            <MenuItem key={`${i}`} onItemEvent={this._getVisibleCallback(element.key as string)}>{child}</MenuItem>
          );
        }
      }
    }

    return (
      <div className='ant-dropdown-menu'>
        {menuItems}
      </div>
    );
  }
}

interface PopupProps {
  popup: React.ReactElement | (() => React.ReactElement);

  trigger?: ('click' | 'hover' | 'contextMenu')[];

  popupVisible?: boolean;
  onPopupVisibleChange?: (visible: boolean) => void;
}

interface PopupState {
  showPopup: boolean;
}

export class Popup extends React.PureComponent<PopupProps, PopupState> {
  state = {showPopup: false};

  showPopup = (visible: boolean) => {
    let {onPopupVisibleChange} = this.props;
    if (onPopupVisibleChange) {
      onPopupVisibleChange(visible);
    } else {
      this.setState({showPopup: visible});
    }
  };

  onBodyKeydown: (e: KeyboardEvent) => void;

  render() {
    let {showPopup} = this.state;
    let {trigger, popupVisible} = this.props;
    if (typeof popupVisible === 'boolean') {
      showPopup = popupVisible;
    }

    if (showPopup && !this.onBodyKeydown) {
      this.onBodyKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          this.showPopup(false);
          document.body.removeEventListener('keydown', this.onBodyKeydown);
          this.onBodyKeydown = null;
        }
      };
      document.body.addEventListener('keydown', this.onBodyKeydown);
    }

    if (!trigger) {
      trigger = ['click'];
    }
    let popupAlign: any = {
      points: ['tl', 'bl'],
      offset: [0, 3],
      overflow: {adjustX: true, adjustY: true}
    };
    let builtinPlacements = {
      topLeft: {points: ['tl', 'tl']}
    };
    let alignPoint: boolean;
    if (trigger[0] === 'contextMenu') {
      popupAlign = {overflow: {adjustX: true, adjustY: true}};
      alignPoint = true;
    }

    let {children, popup} = this.props;

    return (
      <Trigger action={trigger}
               popupAlign={popupAlign} alignPoint={alignPoint} popupPlacement='topLeft'
               builtinPlacements={builtinPlacements}
               prefixCls='ant-select-dropdown'
               popupVisible={showPopup}
               onPopupVisibleChange={this.showPopup}
               popup={popup}>
        {children}
      </Trigger>
    );
  }

  componentWillUnmount(): void {
    if (this.onBodyKeydown) {
      document.body.removeEventListener('keydown', this.onBodyKeydown);
      this.onBodyKeydown = null;
    }
  }
}


