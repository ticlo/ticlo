import {LazyUpdateComponent} from '../component/LazyUpdateComponent';
import {Form, Input, Switch, Modal} from 'antd';
import React from 'react';
import {ClientConn, splitPathName, validateNodeName} from '../../core/editor';
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
    nameEditor: new FormInputItem<string>(this, 'name', t('Name')),
    dispEditor: new FormInputItem<string>(this, 'dispName', t('Name')),
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
    console.log(1123);
    this.setState({visible: false});
  };

  renderImpl() {
    let {path, displayName} = this.props;
    let {visible} = this.state;
    let {nameEditor, dispEditor, changeDisp} = this.formItems;
    let name = path.split('.').pop();
    let enabled = changeDisp.value ? dispEditor.value !== displayName : nameEditor.value !== name;
    return (
      <Modal title={t('Rename')} visible={visible} onOk={this.renameBlock} onCancel={this.onClose}>
        <Form labelCol={{span: 4}} wrapperCol={{span: 20}}>
          {changeDisp.render(
            <Switch onChange={changeDisp.onChange} checkedChildren={t('Display Name')} unCheckedChildren={t('Name')} />
          )}
          {changeDisp.value
            ? dispEditor.render(<Input defaultValue={displayName || ''} onChange={dispEditor.onInputChange} />)
            : nameEditor.render(<Input defaultValue={name} onChange={nameEditor.onInputChange} />)}
        </Form>
      </Modal>
    );
  }
}
