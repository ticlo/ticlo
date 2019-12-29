import React from 'react';
import {ClientConn} from '../../core/connect/ClientConn';
import {Menu, Dropdown, Button} from 'antd';
import {ClickParam} from 'antd/lib/menu';
import {Controlled as CodeMirror} from 'react-codemirror2';
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
import {PropDesc} from '../../core/block/Descriptor';
import {encodeSorted} from '../../core/util/Serialize';

interface Props {
  conn: ClientConn;
  desc: PropDesc;
  paths: string[];
  defaultValue: any;
  readonly?: boolean;
}

interface State {
  value: string;
}

const codeMirrorExtraKeys = {
  Tab: (cm: Editor) => {
    if (cm.getMode().name === 'null') {
      cm.execCommand('insertTab');
    } else {
      if (cm.somethingSelected()) {
        cm.execCommand('indentMore');
      } else {
        cm.execCommand('insertSoftTab');
      }
    }
  }
};

function getEditorMode(desc: PropDesc) {
  switch (desc.type) {
    case 'object':
    case 'array':
      return 'application/json';
    default:
      return desc.mime || 'text/plain';
  }
}

export class TextEditorTab extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    let {defaultValue} = props;

    this.state = {value: this.convertValue(defaultValue)};
    if (isDataTruncated(defaultValue)) {
      let selectedPath = props.paths[0];
      this.loadData(selectedPath);
    }
  }

  loadData(path: string) {
    let {conn} = this.props;
    conn.getValue(path, this.valueLoader);
  }
  valueLoader = {
    onUpdate: (response: DataMap) => {
      this.setState({value: this.convertValue(response.cache.value)});
    }
  };
  convertValue(value: any): string {
    let {desc} = this.props;
    if (getEditorMode(desc) === 'application/json') {
      return encodeSorted(value);
    }
    if (typeof value === 'string') {
      return value;
    }
    return '';
  }

  onBeforeChange = (editor: Editor, data: EditorChange, value: string) => {
    this.setState({value});
  };
  onChange = (editor: Editor, data: EditorChange, value: string) => {};

  onReloadClick = (e: ClickParam) => {
    this.loadData(e.key);
  };

  onApply = () => {};
  onClose = () => {};
  onOK = () => {
    this.onApply();
    this.onClose();
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
    let {desc, readonly} = this.props;
    let {value} = this.state;

    return (
      <div className="ticl-text-editor">
        <CodeMirror
          value={value}
          options={{
            mode: getEditorMode(desc),
            theme: 'eclipse',
            tabSize: 2,
            autofocus: true,
            lineNumbers: true,
            foldGutter: true,
            gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
            extraKeys: codeMirrorExtraKeys
          }}
          onBeforeChange={this.onBeforeChange}
          onChange={this.onChange}
        />
        <div className="ticl-box-footer">
          <Dropdown overlay={this.getReloadMenu} trigger={['click']}>
            <Button size="small">Reload</Button>
          </Dropdown>
          <div className="ticl-spacer" />
          <Button size="small" onClick={this.onClose}>
            Close
          </Button>
          {readonly ? (
            <>
              <Button size="small" onClick={this.onApply}>
                Apply
              </Button>
              <Button size="small" onClick={this.onOK}>
                OK
              </Button>
            </>
          ) : null}
        </div>
      </div>
    );
  }
}
