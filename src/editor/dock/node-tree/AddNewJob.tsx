import {LazyUpdateComponent} from '../../component/LazyUpdateComponent';
import {Form, Input, Modal} from 'antd';
import React from 'react';
import {ClientConn, validateNodeName} from '../../../../src/core/editor';
import {FormInputItem} from '../../component/FormItem';

const {TextArea} = Input;

interface Props {
  conn: ClientConn;
  onClose: () => void;
  visible: boolean;
  basePath?: string;
}

interface State {}

export class AddNewJob extends LazyUpdateComponent<Props, State> {
  state: State = {visible: false};

  formItems = {
    name: new FormInputItem<string>(this, 'name', 'Name'),
    data: new FormInputItem<string>(this, 'data', 'Data')
  };

  addJob = () => {
    let {conn, onClose, basePath} = this.props;
    let {name, data} = this.formItems;
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
      conn.addJob(path, dataData);
    } catch (e) {
      data.setError(String(e));
      name.setError(null);
      return;
    }
    onClose();
  };

  onClose = () => {
    let {onClose} = this.props;
    let {name, data} = this.formItems;
    name.setError(null);
    data.setError(null);
    onClose();
  };

  renderImpl() {
    let {visible, onClose, basePath} = this.props;
    let {name, data} = this.formItems;
    return (
      <Modal title="Add New Job" visible={visible} onOk={this.addJob} onCancel={this.onClose}>
        <Form labelCol={{span: 3}} wrapperCol={{span: 21}}>
          {name.render(<Input addonBefore={basePath} onChange={name.onInputChange} />)}
          {data.render(<TextArea onChange={data.onInputChange} />)}
        </Form>
      </Modal>
    );
  }
}
