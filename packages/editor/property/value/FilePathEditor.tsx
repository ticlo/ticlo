import React from 'react';
import {Button, Input, Space} from 'antd';
import {FolderOpenOutlined} from '@ant-design/icons';
import {classifyFilePath, encodeDisplay} from '@ticlo/core';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext.ts';
import {FilePickerModal} from '../../file-manager/FilePickerModal.tsx';
import {ValueEditorProps} from './ValueEditorBase.ts';

export type FilePathAddonState = 'normal' | 'none' | 'raw';

interface State {
  manualRaw: boolean | null;
  pickerOpen: boolean;
}

function toDisplayText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') return encodeDisplay(value);
  const str = String(value);
  return str.startsWith('+/') ? str.slice(2) : str;
}

export function getFilePathAddonState(
  displayText: string,
  propValue: unknown,
  manualRaw: boolean | null
): FilePathAddonState {
  const kind = classifyFilePath(displayText);
  if (kind === 'url' || kind === 'external' || kind === 'frontend' || kind === 'project') {
    return 'none';
  }
  if (manualRaw !== null) {
    return manualRaw ? 'raw' : 'normal';
  }
  if (typeof propValue === 'string' && propValue.length > 0 && !classifyFilePath(propValue)) {
    return 'raw';
  }
  return 'normal';
}

function currentProjectFromProps(keys?: string[], fallbackProject?: string): string {
  const key = keys?.[0];
  if (key?.startsWith('+')) {
    const id = key.slice(1).split(/[.:]/)[0];
    if (id) return id;
  } else if (key && !key.startsWith('#temp')) {
    return '#root';
  }
  return fallbackProject || '#root';
}

export class FilePathEditor extends React.PureComponent<ValueEditorProps, State> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  state: State = {manualRaw: null, pickerOpen: false};
  _pendingText: string | null = null;

  componentDidUpdate(prevProps: ValueEditorProps) {
    if (prevProps.keys !== this.props.keys) {
      this._pendingText = null;
      if (this.state.manualRaw !== null) {
        this.setState({manualRaw: null});
      }
    } else if (prevProps.value !== this.props.value && this.state.manualRaw !== null) {
      this.setState({manualRaw: null});
    }
  }

  commitText(text: string, addonState: FilePathAddonState) {
    const {onChange, name} = this.props;
    this._pendingText = null;
    const nextValue = addonState === 'normal' && text.length > 0 && !text.startsWith('+/') ? `+/${text}` : text;
    if (nextValue === this.props.value) {
      this.forceUpdate();
    }
    onChange?.(nextValue, name);
  }

  onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const typedPrefix = raw.startsWith('+/');
    const nextText = typedPrefix ? raw.slice(2) : raw;
    if (nextText !== toDisplayText(this.props.value) || this._pendingText != null || typedPrefix) {
      this._pendingText = nextText;
      if (typedPrefix && this.state.manualRaw !== false) {
        this.setState({manualRaw: false});
      } else {
        this.forceUpdate();
      }
    }
  };

  onBlur = () => {
    if (this._pendingText != null) {
      const addonState = getFilePathAddonState(this._pendingText, this.props.value, this.state.manualRaw);
      this.commitText(this._pendingText, addonState);
    }
  };

  onKeyDown = (e: React.KeyboardEvent) => {
    if (!e.ctrlKey && !e.metaKey) {
      e.stopPropagation();
    }
    if (e.key === 'Escape') {
      if (this._pendingText != null || this.state.manualRaw !== null) {
        this._pendingText = null;
        this.setState({manualRaw: null});
        this.forceUpdate();
      }
    } else if (e.key === 'Enter') {
      const text = this._pendingText ?? toDisplayText(this.props.value);
      const addonState = getFilePathAddonState(text, this.props.value, this.state.manualRaw);
      this.commitText(text, addonState);
      e.preventDefault();
    }
  };

  onToggleAddon = () => {
    const {value, name, onChange} = this.props;
    if (onChange == null) return;
    const displayText = this._pendingText ?? toDisplayText(value);
    const addonState = getFilePathAddonState(displayText, value, this.state.manualRaw);
    if (addonState === 'none') return;
    const nextRaw = addonState !== 'raw';
    if (this._pendingText == null) {
      if (nextRaw) {
        if (typeof value === 'string' && value.startsWith('+/')) {
          this.setState({manualRaw: true});
          onChange(value.slice(2), name);
          return;
        }
      } else if (typeof value === 'string' && value.length > 0 && !classifyFilePath(value)) {
        this.setState({manualRaw: false});
        onChange(`+/${value}`, name);
        return;
      }
    }
    this.setState({manualRaw: nextRaw});
  };

  openPicker = () => {
    if (this.props.locked || !this.props.onChange) return;
    this.setState({pickerOpen: true});
  };

  closePicker = () => {
    this.setState({pickerOpen: false});
  };

  onPickPath = (filePath: string) => {
    this._pendingText = null;
    this.setState({manualRaw: null, pickerOpen: false});
    this.props.onChange?.(filePath, this.props.name);
  };

  render() {
    const {desc, locked, keys} = this.props;
    let {value, onChange} = this.props;
    if (locked && this._pendingText == null) {
      onChange = null;
    }
    const disabled = onChange == null;
    const displayText = this._pendingText ?? toDisplayText(value);
    const addonState = getFilePathAddonState(displayText, value, this.state.manualRaw);
    const files = this.context?.getFiles?.();
    const canPick = Boolean(files?.storage);
    const currentProject = currentProjectFromProps(keys, files?.project);

    return (
      <>
        <Space.Compact size="small" className="ticl-e-file-path-editor">
          {addonState !== 'none' && (
            <Button
              key="addon"
              size="small"
              className={
                addonState === 'raw' ? 'ticl-e-file-path-addon ticl-e-file-path-addon-raw' : 'ticl-e-file-path-addon'
              }
              danger={addonState === 'raw'}
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={this.onToggleAddon}
            >
              {addonState === 'raw' ? '?' : '+/'}
            </Button>
          )}
          <Input
            key="input"
            size="small"
            placeholder={desc.placeholder}
            value={displayText}
            disabled={disabled}
            onChange={this.onInputChange}
            onBlur={this.onBlur}
            onKeyDown={this.onKeyDown}
          />
          {canPick && (
            <Button
              key="browse"
              size="small"
              className="ticl-e-file-path-browse"
              icon={<FolderOpenOutlined />}
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={this.openPicker}
            />
          )}
        </Space.Compact>
        {canPick && (
          <FilePickerModal
            open={this.state.pickerOpen}
            storage={files.storage}
            frontendStorage={files.frontendStorage}
            currentProject={currentProject}
            initialValue={this._pendingText != null ? this._pendingText : value}
            onSelectPath={this.onPickPath}
            onCancel={this.closePicker}
          />
        )}
      </>
    );
  }
}
