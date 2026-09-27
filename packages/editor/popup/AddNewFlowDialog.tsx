import {LazyUpdateComponent} from '../component/LazyUpdateComponent.tsx';
import {Form, Input, Modal} from 'antd';
import React from 'react';
import {ClientConn, validateNodeName} from '@ticlo/core/editor.ts';
import {FormInputItem} from '../component/FormItem.tsx';
import {t} from '../component/LocalizedLabel.tsx';

const {TextArea} = Input;

interface Props {
  conn: ClientConn;
  basePath?: string;
  isFolder?: boolean;
}

interface State {
  visible: boolean;
}

export class AddNewFlowDialog extends LazyUpdateComponent<Props, State> {
  state: State = {visible: true};

  formItems = {
    name: new FormInputItem<string>(this, 'name', t('Name')),
    data: new FormInputItem<string>(this, 'data', t('Data')),
  };

  addFlow = async () => {
    const {conn, basePath, isFolder} = this.props;
    const {name, data} = this.formItems;
    if (!name.value) {
      name.setError('Name is Empty');
      data.setError(null);
      return;
    }
    if (!validateNodeName(name.value)) {
      name.setError('Contains Invalid Character');
      data.setError(null);
      return;
    }
    try {
      let dataData: any = null;
      if (data.value) {
        dataData = JSON.parse(data.value);
      }
      let path = name.value;
      if (basePath) {
        path = `${basePath}${path}`;
      }
      if (isFolder) {
        await conn.addFlowFolder(path);
      } else {
        await conn.addFlow(path, dataData);
      }
    } catch (e) {
      (isFolder ? name : data).setError(String(e));
      return;
    }
    this.onClose();
  };

  onClose = () => {
    this.setState({visible: false});
  };

  renderImpl() {
    const {basePath, isFolder} = this.props;
    const {visible} = this.state;
    const {name, data} = this.formItems;
    return (
      <Modal
        title={isFolder ? t('New Folder') : t('New Dataflow')}
        open={visible}
        onOk={this.addFlow}
        onCancel={this.onClose}
      >
        <Form labelCol={{span: 3}} wrapperCol={{span: 21}}>
          {name.render(<Input addonBefore={basePath} onChange={name.onInputChange} />)}
          {!isFolder && data.render(<TextArea onChange={data.onInputChange} />)}
        </Form>
      </Modal>
    );
  }
}
