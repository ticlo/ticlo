import * as ReactDOM from "react-dom";

export function loadTemplate<T extends Element>(element: any): [any, HTMLDivElement] {
  let div = document.createElement('div');
  document.body.appendChild(div);
  return [ReactDOM.render(element, div), div];
}
