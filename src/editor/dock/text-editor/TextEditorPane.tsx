import React from 'react';
import {ClientConn, decode, encode, DataMap, isDataTruncated, translateEditor} from '../../../../src/core/editor';
import {Menu, Dropdown, Button, Spin} from 'antd';
import CodeMirror from '@uiw/react-codemirror';

import {javascript} from '@codemirror/lang-javascript';
import {markdown, markdownLanguage} from '@codemirror/lang-markdown';
import {json} from '@codemirror/lang-json';

import {DockLayout} from 'rc-dock';
import {TabData} from 'rc-dock/src/DockData';
import {EditorView} from '@codemirror/view';
import {MenuProps} from 'antd/lib/menu';

interface Props {
  conn: ClientConn;
  mime: string;
  asObject: boolean;
  paths: string[];
  defaultValue: any;
  readonly?: boolean;
  onClose?: () => void;
}

interface State {
  value: string;
  loading: boolean;
  error?: string;
}

export class TextEditorPane extends React.PureComponent<Props, State> {
  static openFloatPanel(
    layout: DockLayout,
    conn: ClientConn,
    paths: string[],
    defaultValue: any,
    mime: string,
    readonly?: boolean
  ) {
    if (!paths?.length) {
      // invalid paths
      return;
    }
    let sortedPaths = [...paths].sort();
    let id = `textEditor-${sortedPaths.join('..')}`;
    let oldTab = layout.find(id) as TabData;
    if (oldTab) {
      layout.dockMove(oldTab, null, 'front');
      return;
    }

    let asObject = false;
    if (mime === 'object') {
      mime = 'application/json';
      asObject = true;
    }

    let w = 400;
    let h = 500;
    let {width, height} = layout.getLayoutSize();
    if (!width || !height) {
      return;
    }

    if (w > width) {
      w = width;
    }
    if (h > height) {
      h = height;
    }
    let x = (width - w) >> 1;
    let y = (height - h) >> 1;
    if (y > 320) {
      y = 320;
    }

    let firstPathParts = paths[0].split('.');
    let tabName = `${translateEditor('Edit')} ${firstPathParts.slice(firstPathParts.length - 2).join('.')}`;
    if (paths.length > 1) {
      tabName = `${tabName} (+${paths.length - 1})`;
    }

    const onClose = () => {
      let tab = layout.find(id) as TabData;
      if (tab) {
        layout.dockMove(tab, null, 'remove');
      }
    };
    let newPanel = {
      activeId: id,
      tabs: [
        {
          id,
          closable: true,
          title: tabName,
          content: (
            <TextEditorPane
              conn={conn}
              mime={mime}
              asObject={asObject}
              paths={paths}
              defaultValue={defaultValue}
              onClose={onClose}
              readonly={readonly}
            />
          ),
        },
      ],
      x,
      y,
      w,
      h,
    };
    layout.dockMove(newPanel, null, 'float');
  }

  onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'F' && e.shiftKey && e.altKey) {
      // format code
      let {mime} = this.props;
      if (mime === 'application/json') {
        let value = this._currentValue;
        try {
          let obj = decode(value);
          this._codeMirrorView?.dispatch({
            changes: {from: 0, to: this._codeMirrorView.state.doc.length, insert: encode(obj, 2)},
          });
        } catch (e) {
          this.setState({error: e.toString()});
        }
      }
      e.stopPropagation();
      e.preventDefault();
    }
  };

  // codeMirrorExtraKeys = {
  //   'Tab': (cm: Editor) => {
  //     if (cm.getMode().name === 'null') {
  //       cm.execCommand('insertTab');
  //     } else {
  //       if (cm.somethingSelected()) {
  //         cm.execCommand('indentCustom');
  //       } else {
  //         cm.execCommand('insertSoftTab');
  //       }
  //     }
  //   },
  //   'Shift-Alt-F': (cm: Editor) => {
  //     // format code
  //     let {mime} = this.props;
  //     if (mime === 'application/json') {
  //       let value = cm.getValue();
  //       try {
  //         let obj = decode(value);
  //         cm.setValue(encode(obj, 2));
  //       } catch (e) {
  //         this.setState({error: e.toString()});
  //       }
  //     }
  //   },
  // };

  constructor(props: Props) {
    super(props);
    let {defaultValue} = props;

    if (isDataTruncated(defaultValue)) {
      let selectedPath = props.paths[0];
      this.loadData(selectedPath);
      this.state = {value: this.convertValue(defaultValue), loading: true};
    } else {
      this.state = {value: this.convertValue(defaultValue), loading: false};
    }
    this._currentValue = this.state.value;
  }

  _codeMirrorView: EditorView;
  getCodeMirror = (codeMirror: {view: EditorView}) => {
    this._codeMirrorView = codeMirror?.view;
  };

  loadData(path: string) {
    let {conn} = this.props;
    conn.getValue(path, this.valueLoader);
  }
  valueLoader = {
    onError: (error: string) => {
      this.setState({value: '', loading: false, error});
    },
    onUpdate: (response: DataMap) => {
      this.setState({value: this.convertValue(response.value), loading: false});
    },
  };

  convertValue(value: any): string {
    let {asObject} = this.props;
    if (value === undefined) {
      return '';
    }
    if (asObject) {
      return encode(value, 2);
    }
    if (value === null) {
      // allow null to be encoded only when asObject=true
      // convert it to empty string in other cases
      return '';
    }
    if (typeof value !== 'string') {
      return encode(value, 2);
    }
    return value;
  }

  _currentValue: string;
  onChange = (value: string) => {
    this._currentValue = value;
    if (this.state.error) {
      this.setState({error: null});
    }
  };

  onReloadClick = (e: {key: React.Key}) => {
    this.loadData(e.key as string);
  };

  onApply = () => {
    let {asObject, paths, conn} = this.props;
    let {loading} = this.state;
    if (loading) {
      return false;
    }
    let value: any = this._currentValue;
    if (asObject) {
      try {
        value = decode(value);
      } catch (e) {
        this.setState({error: e.toString()});
        return false;
      }
    }
    for (let path of paths) {
      conn.setValue(path, value);
    }
    return true;
  };
  onClose = () => {
    this.props.onClose?.();
  };
  onOK = () => {
    if (this.onApply()) {
      this.onClose();
    }
  };

  getReloadMenu = (): MenuProps => {
    let {paths} = this.props;

    let menu: MenuProps = {items: [], onClick: this.onReloadClick};
    for (let path of paths) {
      menu.items.push({label: path, key: path});
    }
    return menu;
  };

  render() {
    let {mime, readonly, onClose} = this.props;
    let {value, error, loading} = this.state;
    let extensions: any;
    switch (mime) {
      case 'application/json':
        extensions = [json()];
        break;
      case 'text/javascript':
        extensions = [javascript()];
        break;
      case 'text/jsx':
        extensions = [javascript({jsx: true})];
        break;
      case 'text/x-markdown':
        extensions = [markdown({base: markdownLanguage})];
        break;
    }
    return (
      <div className="ticl-text-editor" onKeyDownCapture={this.onKeyDown}>
        {loading ? (
          <div className="ticl-spacer ticl-hbox ticl-center-box">
            <Spin tip="Loading..." />
          </div>
        ) : (
          <CodeMirror
            ref={this.getCodeMirror}
            className={error ? 'ticl-text-codemirror ticl-error-box' : 'ticl-text-codemirror'}
            value={value}
            theme="light"
            autoFocus={true}
            extensions={extensions}
            // options={{
            //   tabSize: 2,
            //   extraKeys: this.codeMirrorExtraKeys,
            // }}
            onChange={this.onChange}
          />
        )}
        {error ? <div className="ticl-error-message">{error}</div> : null}
        <div className="ticl-box-footer">
          <Dropdown menu={this.getReloadMenu()} trigger={['click']}>
            <Button size="small">Reload</Button>
          </Dropdown>
          <div className="ticl-spacer" />
          {onClose ? (
            <Button size="small" onClick={this.onClose}>
              Close
            </Button>
          ) : null}
          {!readonly ? (
            <Button size="small" disabled={loading} onClick={this.onApply}>
              Apply
            </Button>
          ) : null}
          {onClose && !readonly ? (
            <Button size="small" disabled={loading} onClick={this.onOK}>
              OK
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
}
