import {LazyUpdateComponent} from '../component/LazyUpdateComponent.tsx';
import {Form, Input, Switch, Modal} from 'antd';
import React from 'react';
import {ClientConn, splitPathName, validateNodeName} from '@ticlo/core/editor.ts';
import {FormInputItem, FormItem} from '../component/FormItem.tsx';
import {t} from '../component/LocalizedLabel.tsx';
import {EditPolicyContext} from '../component/EditPolicyContext.tsx';

const {TextArea} = Input;

interface Props {
  checkPolicy?: boolean;
  conn: ClientConn;
  path: string;
  displayName: string;
}

interface State {
  visible: boolean;
}

export class RenameDialog extends LazyUpdateComponent<Props, State> {
  static contextType = EditPolicyContext;
  declare context: React.ContextType<typeof EditPolicyContext>;

  canRename() {
    if (!this.props.checkPolicy) return true;
    const {path} = this.props;
    const {nameEditor, dispEditor, changeDisp} = this.formItems;
    return this.context.can(
      changeDisp.value
        ? {cmd: 'set', path: `${path}.@b-name`, value: dispEditor.value}
        : {cmd: 'renameProp', path, newName: nameEditor.value}
    );
  }
  state: State = {visible: true};

  formItems = {
    changeDisp: new FormItem<boolean>(this, 'changeDisp', t('Change'), Boolean(this.props.displayName)),
    nameEditor: new FormInputItem<string>(this, 'name', t('Name'), this.props.path.split('.').pop()),
    dispEditor: new FormInputItem<string>(this, 'dispName', t('Name'), this.props.displayName ?? ''),
  };

  renameBlock = () => {
    if (!this.canRename()) return;
    const {conn, path, displayName} = this.props;
    const {nameEditor, dispEditor, changeDisp} = this.formItems;

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
      const [parentPath, name] = splitPathName(path);
      if (nameEditor.value !== name) {
        conn.renameProp(path, nameEditor.value);
        const basePath = conn.childrenChangeStream().dispatch({path: parentPath});
      }
    }
    this.onClose();
  };

  onClose = () => {
    this.setState({visible: false});
  };

  renderImpl() {
    const {path, displayName} = this.props;
    const {visible} = this.state;
    const {nameEditor, dispEditor, changeDisp} = this.formItems;
    const name = path.split('.').pop();
    const enabled = changeDisp.value ? dispEditor.value !== displayName : nameEditor.value !== name;
    return (
      <Modal
        title={t('Rename')}
        open={visible}
        onOk={this.renameBlock}
        onCancel={this.onClose}
        okButtonProps={{disabled: !enabled || !this.canRename()}}
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
