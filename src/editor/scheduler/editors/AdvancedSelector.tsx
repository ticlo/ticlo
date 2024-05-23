import React from 'react';

interface Props {
  current: any;
  onChange: (values: {}) => void;
}
interface State {}
export class DateSelector extends React.PureComponent<Props, State> {}
