import * as ReactDOM from "react-dom";

function loadOneCss(url: string) {
  let head = document.querySelector('head');
  let link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = url;
  if (url.startsWith('http')) {
    link.crossOrigin = 'anonymous';
  }
  head.appendChild(link);
}

function loadCssInHeader() {
  if (!(window as any).ticloCssLoaded) {
    loadOneCss('https://fonts.googleapis.com/css?family=Fredoka+One');
    loadOneCss('/base/dist/antd.css');
    loadOneCss('/base/dist/editor.css');
    loadOneCss('/base/dist/icons.css');
    (window as any).ticloCssLoaded = true;
  }
}

export function loadTemplate<T extends Element>(element: any, style?: string): [any, HTMLDivElement] {
  if (style === 'editor') {
    loadCssInHeader();
  }
  let div = document.createElement('div');
  document.body.appendChild(div);
  return [ReactDOM.render(element, div), div];
}
