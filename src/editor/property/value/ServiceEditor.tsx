import React from "react";
import {ClientConnection} from "../../../core/connect/ClientConnection";
import {PropDesc} from "../../../core/block/Descriptor";
import {arrayEqual} from "../../../core/util/Compare";

export interface Props {
  conn?: ClientConnection;
  value: any;
  bindingPath: string;
  desc: PropDesc;
  locked?: boolean;
  onPathChange?: (path: string) => void;
}

interface State {
  opened?: null | 'add' | 'edit';
}


export class ServiceEditor extends React.PureComponent<Props, State> {

  state: State = {};

  watchedTypes: string[] = [];

  render() {
    let {desc} = this.props;
    let {opened} = this.state;

    let watchTypes = desc.options || [];
    if (arrayEqual(watchTypes, this.watchedTypes)) {

    }


    return <div/>;
  }
}