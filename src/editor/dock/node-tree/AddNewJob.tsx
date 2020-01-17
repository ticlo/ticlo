import {LazyUpdateComponent} from '../../component/LazyUpdateComponent';
import {Input, Modal} from 'antd';
import React, {ChangeEvent} from 'react';
import {ClientConn, decode} from '../../../../src/core/editor';

const {TextArea} = Input;

interface Props {
  conn: ClientConn;
  onClose: () => void;
  visible: boolean;
}

interface State {}

export class AddNewJob extends LazyUpdateComponent<Props, State> {
  state: State = {visible: false};

  jobPath: string;
  setJobPath = (change: ChangeEvent<HTMLInputElement>) => {
    this.jobPath = change.target.value;
  };
  jobData: string;
  setJobData = (change: ChangeEvent<HTMLTextAreaElement>) => {
    this.jobData = change.target.value;
  };

  addJob = () => {
    let {conn, onClose} = this.props;
    if (!this.jobPath) {
      return;
    }
    try {
      let data: any = null;
      if (this.jobData?.startsWith('{')) {
        data = decode(this.jobData);
      }
      this.props.conn.addJob(this.jobPath, data);
    } catch (e) {}

    onClose();
  };

  renderImpl() {
    let {visible, onClose} = this.props;
    return (
      <Modal title="Add New Job" visible={visible} onOk={this.addJob} onCancel={onClose}>
        Path:
        <Input onChange={this.setJobPath} />
        Data:
        <TextArea placeholder="Empty Job" onChange={this.setJobData} />
      </Modal>
    );
  }
}
