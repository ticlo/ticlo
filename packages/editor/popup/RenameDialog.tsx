import {LazyUpdateComponent} from '../component/LazyUpdateComponent';
import {Form, Input, Switch, Modal} from 'antd';
import React from 'react';
import {ClientConn, splitPathName, validateNodeName} from '@ticlo/core';
import {FormInputItem, FormItem} from '../component/FormItem';
import {t} from '../component/LocalizedLabel';

const {TextArea} = Input;

interface Props {
  conn: ClientConn;
  path: string;
  displayName: string;
}

interface State {
  visible: boolean;
}

export class RenameDialog extends LazyUpdateComponent<Props, State> {
  state: State = {visible: true};

  formItems = {
    changeDisp: new FormItem<boolean>(this, 'changeDisp', t('Change'), Boolean(this.props.displayName)),
    nameEditor: new FormInputItem<string>(this, 'name', t('Name'), this.props.path.split('.').pop()),
    dispEditor: new FormInputItem<string>(this, 'dispName', t('Name'), this.props.displayName ?? ''),
  };

  renameBlock = () => {
    let {conn, path, displayName} = this.props;
    let {nameEditor, dispEditor, changeDisp} = this.formItems;

    if (!changeDisp.value && validateNodeName(nameEditor.value)) {
      nameEditor.setError('Contains Invalid Character');
    } else {
      nameEditor.setError(null);
    }

    if (changeDisp.value) {
      if (dispEditor.value !== displayName) {
        conn.setValue(`${path}.@b-name`, dispEditor.value || undefined);
      }
    } else {
      let [parentPath, name] = splitPathName(path);
      if (nameEditor.value !== name) {
        conn.renameProp(path, nameEditor.value);
        let basePath = conn.childrenChangeStream().dispatch({path: parentPath});
      }
    }
    this.onClose();
  };

  onClose = () => {
    this.setState({visible: false});
  };

  renderImpl() {
    let {path, displayName} = this.props;
    let {visible} = this.state;
    let {nameEditor, dispEditor, changeDisp} = this.formItems;
    let name = path.split('.').pop();
    let enabled = changeDisp.value ? dispEditor.value !== displayName : nameEditor.value !== name;
    return (
      <Modal
        title={t('Rename')}
        open={visible}
        onOk={this.renameBlock}
        onCancel={this.onClose}
        okButtonProps={{disabled: !enabled}}
      >
        <Form labelCol={{span: 4}} wrapperCol={{span: 20}}>
          {changeDisp.render(
            <Switch
              onChange={changeDisp.onChange}
              checked={changeDisp.value}
              checkedChildren={t('Display Name')}
              unCheckedChildren={t('Name')}
            />
          )}
          {changeDisp.value
            ? dispEditor.render(<Input value={dispEditor.value} onChange={dispEditor.onInputChange} />)
            : nameEditor.render(<Input value={nameEditor.value} onChange={nameEditor.onInputChange} />)}
        </Form>
      </Modal>
    );
  }
}
