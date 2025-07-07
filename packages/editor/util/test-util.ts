import ReactDOM from 'react-dom';
import {createRoot, Root} from 'react-dom/client';

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
    // For Vite, we need to use the correct paths
    loadOneCss('/app/css/antd.css');
    loadOneCss('/app/css/editor.css');
    loadOneCss('/app/css/icons.css');
    (window as any).ticloCssLoaded = true;
  }
}

let _lastTemplateDiv: HTMLDivElement;
let _lastTemplateRoot: Root;

export function loadTemplate<T extends Element>(element: any, style?: string): [any, HTMLDivElement] {
  if (style === 'editor') {
    loadCssInHeader();
  }
  _lastTemplateDiv = document.createElement('div');
  _lastTemplateDiv.style.position = 'absolute';
  _lastTemplateDiv.style.width = '1000px';
  _lastTemplateDiv.style.height = '1000px';
  document.body.appendChild(_lastTemplateDiv);
  _lastTemplateRoot = createRoot(_lastTemplateDiv);
  return [_lastTemplateRoot.render(element), _lastTemplateDiv];
}

export function expandDocumentBody() {
  window.document.body.style.position = 'absolute';
  window.document.body.style.width = '1000px';
  window.document.body.style.height = '1000px';
}

// remove the last loaded template
export function removeLastTemplate() {
  if (_lastTemplateRoot) {
    _lastTemplateRoot.unmount();
    if (_lastTemplateDiv.parentElement) {
      _lastTemplateDiv.parentElement.removeChild(_lastTemplateDiv);
    }
    _lastTemplateDiv = null;
  }
  window.onerror = null;
}

// replace "div.cls1.cls2" to div[contains(@class,'cls1')][contains(@class,'cls2')]
function xpathReplacer(match: string, g1: string, g2: string, str: string): string {
  return (
    g1 +
    g2
      .split('.')
      .map((str) => `[contains(@class,'${str}')]`)
      .join('')
  );
}

// select a single element with a simplified xpath
export function querySingle(query: string, element: HTMLElement = document.body): HTMLElement {
  let xpath = query.replace(/\b(div|span|li)\.([\w\-.]+)/g, xpathReplacer);
  return document.evaluate(xpath, element, null, 9, null).singleNodeValue as HTMLElement;
}

export function fakeMouseEvent(x = 0, y = 0, extra?: any) {
  let result: any = {...extra};
  result.clientX = x;
  result.clientY = y;
  result.pageX = x;
  result.pageY = y;
  return result;
}
