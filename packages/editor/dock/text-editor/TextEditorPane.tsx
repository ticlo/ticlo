import React from 'react';
import {ClientConn, encode, DataMap, isDataTruncated, translateEditor} from '@ticlo/core/editor.ts';
import {Menu, Dropdown, Button, Spin} from 'antd';
import CodeMirror from '@uiw/react-codemirror';
import {parse as ParseYaml} from 'yaml';

import {javascript} from '@codemirror/lang-javascript';
import {markdown, markdownLanguage} from '@codemirror/lang-markdown';
import {yaml} from '@codemirror/lang-yaml';
import {HighlightStyle, syntaxHighlighting} from '@codemirror/language';
import {tags} from '@lezer/highlight';

import {DockLayout} from 'rc-dock';
import {EditorView} from '@codemirror/view';
import {MenuProps} from 'antd';
import {createDockDialog, DockDialogPane} from '../../component/DockDialogPane.tsx';
import {t} from '../../component/LocalizedLabel.tsx';
import {arrowReviver} from '@ticlo/core/util/Serialize.ts';
import {EditPolicyContext} from '../../component/EditPolicyContext.tsx';

const editorTheme = EditorView.theme({
  '&': {color: 'var(--ant-color-text, #000)', backgroundColor: 'var(--ant-color-bg-container, #fff)'},
  '.cm-content': {caretColor: 'var(--ant-color-text, #000)'},
  '.cm-gutters': {
    color: 'var(--ant-color-text-secondary, #666)',
    backgroundColor: 'var(--ant-color-bg-layout, #f5f5f5)',
    borderColor: 'var(--ant-color-border, #ddd)',
  },
  '.cm-activeLine, .cm-activeLineGutter': {backgroundColor: 'var(--ant-color-fill-quaternary, #f8f8f8)'},
  '&.cm-focused .cm-cursor': {borderLeftColor: 'var(--ant-color-text, #000)'},
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--ant-control-item-bg-active, #e6f4ff)',
  },
});

const editorHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    {
      tag: [tags.keyword, tags.propertyName, tags.typeName, tags.tagName],
      color: 'var(--ticl-code-keyword-color, var(--ant-color-primary, #1677ff))',
    },
    {tag: [tags.string, tags.regexp], color: 'var(--ticl-code-string-color, var(--ant-color-success, #389e0d))'},
    {
      tag: [tags.number, tags.bool, tags.null],
      color: 'var(--ticl-code-number-color, var(--ant-color-warning, #d48806))',
    },
    {tag: tags.comment, color: 'var(--ant-color-text-secondary, #666)'},
    {tag: tags.invalid, color: 'var(--ant-color-error, #ff4d4f)'},
  ])
);

interface Props {
  conn: ClientConn;
  mime: string;
  asObject: boolean;
  paths: string[];
  defaultValue: any;
  readonly?: boolean;
}

interface State {
  value: string;
  loading: boolean;
  error?: string;
}

export class TextEditorPane extends React.PureComponent<Props, State> {
  static contextType = EditPolicyContext;
  declare context: React.ContextType<typeof EditPolicyContext>;
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
    const sortedPaths = [...paths].sort();
    const id = `textEditor-${sortedPaths.join('..')}`;

    const firstPathParts = paths[0].split('.');
    let title = `${translateEditor('Edit')} ${firstPathParts.slice(firstPathParts.length - 2).join('.')}`;
    if (paths.length > 1) {
      title = `${title} (+${paths.length - 1})`;
    }

    let asObject = false;
    if (mime === 'object') {
      mime = 'application/json';
      asObject = true;
    }

    createDockDialog(
      layout,
      title,
      <TextEditorPane
        conn={conn}
        mime={mime}
        asObject={asObject}
        paths={paths}
        defaultValue={defaultValue}
        readonly={readonly}
      />,
      id,
      {preferredWidth: 400, preferredHeight: 500}
    );
  }

  onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'F' && e.shiftKey && e.altKey) {
      // format code
      const {mime} = this.props;
      if (mime === 'application/json') {
        const value = this._currentValue;
        try {
          // parse yaml first, then convert it to json, and decode with arrow
          const yamlParsed = ParseYaml(value, arrowReviver);
          this._codeMirrorView?.dispatch({
            changes: {from: 0, to: this._codeMirrorView.state.doc.length, insert: value},
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
    const {defaultValue} = props;

    if (isDataTruncated(defaultValue)) {
      const selectedPath = props.paths[0];
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
    const {conn} = this.props;
    conn
      .getValue(path)
      .then((response: DataMap) => {
        this.setState({value: this.convertValue(response.value), loading: false});
      })
      .catch((error: string) => {
        this.setState({value: '', loading: false, error});
      });
  }
  convertValue(value: any): string {
    const {asObject} = this.props;
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

  onReloadMenuClick = (e: {key: React.Key}) => {
    this.loadData(e.key as string);
  };
  onReloadClick = () => {
    const {paths} = this.props;
    this.loadData(paths[0]);
  };

  onApply = () => {
    const {asObject, paths, conn} = this.props;
    const {loading} = this.state;
    if (loading || this.props.readonly) {
      return false;
    }
    let value: any = this._currentValue;
    if (asObject) {
      try {
        value = ParseYaml(value, arrowReviver);
      } catch (e) {
        this.setState({error: e.toString()});
        return false;
      }
    }
    for (const path of paths) {
      const error = this.context.check({cmd: 'set', path, value});
      if (error) {
        this.setState({error});
        return false;
      }
    }
    for (const path of paths) {
      conn.setValue(path, value);
    }
    return true;
  };

  getReloadMenu = (): MenuProps => {
    const {paths} = this.props;

    const menu: MenuProps = {items: [], onClick: this.onReloadMenuClick};
    for (const path of paths) {
      menu.items.push({label: path, key: path});
    }
    return menu;
  };

  render() {
    const {mime, paths} = this.props;
    const readonly = this.props.readonly || !paths.every((path) => this.context.canWriteField(path));
    const {value, error, loading} = this.state;
    let extensions: any;
    switch (mime) {
      case 'application/json':
        extensions = [yaml()];
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
      <DockDialogPane
        onApply={readonly ? null : this.onApply}
        saveDisabled={loading}
        footerExtra={
          paths.length === 1 ? (
            <Button size="small" onClick={this.onReloadClick}>
              {t('Reload')}
            </Button>
          ) : (
            <Dropdown menu={this.getReloadMenu()} trigger={['click']}>
              <Button size="small">{t('Reload')}</Button>
            </Dropdown>
          )
        }
        error={error}
        onKeyDownCapture={this.onKeyDown}
      >
        {loading ? (
          <div className="ticl-e-spacer ticl-e-hbox ticl-e-center-box">
            <Spin tip="Loading..." />
          </div>
        ) : (
          <CodeMirror
            ref={this.getCodeMirror}
            className={error ? 'ticl-e-text-codemirror ticl-e-error-box' : 'ticl-e-text-codemirror'}
            value={value}
            readOnly={readonly}
            theme={editorTheme}
            autoFocus={true}
            extensions={[editorHighlighting, ...(extensions ?? [])]}
            // options={{
            //   tabSize: 2,
            //   extraKeys: this.codeMirrorExtraKeys,
            // }}
            onChange={this.onChange}
          />
        )}
      </DockDialogPane>
    );
  }
}
