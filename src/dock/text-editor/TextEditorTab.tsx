import React from 'react';
import {ClientConn} from '../../core/connect/ClientConn';
import {Menu, Dropdown, Button, Spin} from 'antd';
import {ClickParam} from 'antd/lib/menu';
import {UnControlled as CodeMirror} from 'react-codemirror2';
import {Editor, EditorChange} from 'codemirror';

import 'codemirror/mode/xml/xml';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/jsx/jsx';

import 'codemirror/addon/fold/foldcode.js';
import 'codemirror/addon/fold/foldgutter.js';
import 'codemirror/addon/fold/brace-fold';
import 'codemirror/addon/fold/comment-fold';

import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/eclipse.css';
import 'codemirror/addon/fold/foldgutter.css';

import './TextEditorTab.less';

import {DataMap, isDataTruncated} from '../../core/util/DataTypes';
import {decode, encode} from '../../core/util/Serialize';
import {DockLayout} from 'rc-dock/lib';
import {mapPointsBetweenElement} from '../../ui/util/Position';

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

export class TextEditorTab extends React.PureComponent<Props, State> {
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
    let oldTab = layout.find(id);
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
    let tabName = `Edit ${firstPathParts.slice(firstPathParts.length - 2).join('.')}`;
    if (paths.length > 1) {
      tabName = `${tabName} (+${paths.length - 1})`;
    }

    const onClose = () => {
      let tab = layout.find(id);
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
            <TextEditorTab
              conn={conn}
              mime={mime}
              asObject={asObject}
              paths={paths}
              defaultValue={defaultValue}
              onClose={onClose}
              readonly={readonly}
            />
          )
        }
      ],
      x,
      y,
      w,
      h
    };
    layout.dockMove(newPanel, null, 'float');
  }

  codeMirrorExtraKeys = {
    'Tab': (cm: Editor) => {
      if (cm.getMode().name === 'null') {
        cm.execCommand('insertTab');
      } else {
        if (cm.somethingSelected()) {
          cm.execCommand('indentMore');
        } else {
          cm.execCommand('insertSoftTab');
        }
      }
    },
    'Shift-Alt-F': (cm: Editor) => {
      // format code
      let {mime} = this.props;
      if (mime === 'application/json') {
        let value = cm.getValue();
        try {
          let obj = decode(value);
          cm.setValue(encode(obj, 2));
        } catch (e) {
          this.setState({error: e.toString()});
        }
      }
    }
  };

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
  }
  _codeMirror: CodeMirror;
  getCodeMirror = (cm: CodeMirror) => {
    this._codeMirror = cm;
  };

  getEditor() {
    if (this._codeMirror) {
      return (this._codeMirror as any).editor as Editor;
    }
    return null;
  }

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
    }
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

  onChange = (editor: Editor, data: EditorChange, value: string) => {
    if (this.state.error) {
      this.setState({error: null});
    }
  };

  onReloadClick = (e: ClickParam) => {
    this.loadData(e.key);
  };

  onApply = () => {
    let {asObject, paths, conn} = this.props;
    let {loading} = this.state;
    if (loading) {
      return false;
    }
    let value: any = this.getEditor().getValue();
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

  getReloadMenu = () => {
    let {paths} = this.props;
    let options: React.ReactNode[] = [];
    for (let path of paths) {
      options.push(<Menu.Item key={path}>{path}</Menu.Item>);
    }
    return <Menu onClick={this.onReloadClick}>{options}</Menu>;
  };

  render() {
    let {mime, readonly, onClose} = this.props;
    let {value, error, loading} = this.state;

    return (
      <div className="ticl-text-editor">
        {loading ? (
          <div className="ticl-spacer ticl-hbox ticl-center-box">
            <Spin tip="Loading..." />
          </div>
        ) : (
          <CodeMirror
            ref={this.getCodeMirror}
            className={error ? 'ticl-error-box' : null}
            value={value}
            options={{
              mode: mime,
              theme: 'eclipse',
              tabSize: 2,
              autofocus: true,
              lineNumbers: true,
              foldGutter: true,
              gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
              extraKeys: this.codeMirrorExtraKeys
            }}
            onChange={this.onChange}
          />
        )}
        {error ? <div className="ticl-error-message">{error}</div> : null}
        <div className="ticl-box-footer">
          <Dropdown overlay={this.getReloadMenu} trigger={['click']}>
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
