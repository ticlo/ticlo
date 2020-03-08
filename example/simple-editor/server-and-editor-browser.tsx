import * as React from 'react';
import * as ReactDOM from 'react-dom';
import {Block, DataMap, decode, encodeSorted, FunctionDesc, Job, PropDesc, Root} from '../../src/core';
import {makeLocalConnection} from '../../src/core/connect/LocalConnection';
import {data} from '../sample-data/data';
import reactData from '../sample-data/react';
import {initEditor, PropertyList, BlockStage, NodeTree} from '../../src/editor';
import {DragDropDiv, DragState, DockLayout, DockContextType} from 'rc-dock';
import {ClientConnection} from '../../src/core/connect/ClientConnection';
import {Functions} from '../../src/core/block/Functions';
import {FunctionTree} from '../../src/editor/function-selector/FunctionTree';

import './sample-blocks';
import {Logger} from '../../src/core/util/Logger';
import {WorkerFunction} from '../../src/core/worker/WorkerFunction';
import {BlockStagePane} from '../../src/editor/dock/block/BlockStagePane';
import {TicloLayoutContext, TicloLayoutContextType} from '../../src/editor/component/LayoutContext';
import {PropDispatcher} from '../../src/core/block/Dispatcher';
import {PropertyListPane} from '../../src/editor/dock/property/PropertyListPane';
import {NodeTreePane} from '../../src/editor/dock/node-tree/NodeTreePane';
import {TextEditorPane} from '../../src/editor/dock/text-editor/TextEditorPane';
import '../../src/html';
import '../../src/react';
import {FunctionSelect} from '../../src/editor/function-selector/FunctionSelector';
import JsonEsc from 'jsonesc/dist';

const layoutGroups = {
  blockStage: {
    animated: false,
    floatable: true
  }
};

interface Props {
  conn: ClientConnection;
}

interface State {}

WorkerFunction.registerType(
  {
    '#is': '',
    '#shared': {
      '#is': '',
      'add': {
        '0': 1,
        '1': 2,
        '#is': 'add',
        '@b-p': ['0', '1', '#output'],
        '@b-xyw': [11, 212, 150]
      }
    },
    '#inputs': {
      '#is': '',
      '@b-xyw': [100, 100, 150],
      '#custom': [
        {
          name: 'num',
          type: 'number'
        }
      ]
    },
    '#outputs': {
      '#is': '',
      '@b-xyw': [388, 93, 150],
      '#custom': [
        {
          name: 'ooo',
          type: 'number'
        }
      ],
      '@b-p': ['ooo'],
      '~ooo': '##.multiply.#output'
    },
    'multiply': {
      '0': 1,
      '#is': 'multiply',
      '@b-p': ['0', '1', '#output'],
      '@b-xyw': [269, 239, 150],
      '~1': '##.#shared.add.#output'
    }
  },
  {name: 'class1', properties: [{name: 'num', type: 'number'}, {name: 'ooo', type: 'number'}]},
  ''
);

class App extends React.PureComponent<Props, State> implements TicloLayoutContext {
  constructor(props: Props) {
    super(props);
  }

  forceUpdateLambda = () => this.forceUpdate();
  forceUpdateImmediate = () => {
    this.props.conn.callImmediate(this.forceUpdateLambda);
  };

  layout: DockLayout;
  getLayout = (layout: DockLayout) => {
    this.layout = layout;
  };

  selectedPaths: PropDispatcher<string[]> = new PropDispatcher();

  onSelect = (paths: string[], handled: boolean = false) => {
    if (!handled) {
      this.selectedPaths.updateValue(paths);
    }
  };

  createBlockEditorTab(path: string, onSave?: () => void) {
    let {conn} = this.props;
    return BlockStagePane.createDockTab(path, conn, this.onSelect, onSave);
  }

  /// implements TicloLayoutContext
  editJob(path: string, onSave: () => void) {
    this.layout.dockMove(this.createBlockEditorTab(path, onSave), this.layout.find('main'), 'middle');
  }

  editProperty(paths: string[], propDesc: PropDesc, defaultValue?: any, mime?: string, readonly?: boolean): void {
    let {conn} = this.props;
    if (!mime) {
      if (propDesc.mime) {
        mime = propDesc.mime;
      } else if (propDesc.type === 'object' || propDesc.type === 'array') {
        mime = 'application/json';
      }
    }
    TextEditorPane.openFloatPanel(this.layout, conn, paths, defaultValue, mime, readonly);
  }

  onDragBlock = (e: DragState) => {
    let {conn} = this.props;
    e.setData(
      {
        block: {
          '#is': 'add',
          '1': 4,
          '@b-p': ['0', '1', 'output', '@b-p', '#is']
        }
      },
      conn
    );
    e.startDrag();
  };
  onDragSlider = (e: DragState) => {
    let {conn} = this.props;
    e.setData(
      {
        block: {
          '#is': 'slider-view',
          '@b-p': ['value']
        }
      },
      conn
    );
    e.startDrag();
  };

  render() {
    let {conn} = this.props;

    let layout: any = {
      dockbox: {
        mode: 'horizontal',
        children: [
          {
            mode: 'vertical',
            size: 200,
            children: [
              {
                tabs: [
                  {
                    id: 'Navigation',
                    title: 'Navigation',
                    cached: true,
                    cacheContext: TicloLayoutContextType,
                    content: (
                      <NodeTreePane
                        conn={conn}
                        basePaths={['']}
                        hideRoot={true}
                        onSelect={this.onSelect}
                        showMenu={true}
                      />
                    )
                  },
                  {
                    id: 'Test UI',
                    title: 'Test UI',
                    cached: true,
                    content: <div id="main" />
                  }
                ]
              },
              {
                tabs: [
                  {
                    id: 'Functions',
                    title: 'Functions',
                    cached: true,
                    cacheContext: TicloLayoutContextType,
                    content: <FunctionSelect conn={conn} />
                  },
                  {
                    id: 'Properties',
                    title: 'Properties',
                    cached: true,
                    cacheContext: TicloLayoutContextType,
                    content: <PropertyListPane conn={conn} />
                  }
                ]
              }
            ]
          },
          {
            size: 800,
            tabs: [this.createBlockEditorTab('example'), this.createBlockEditorTab('example')],
            id: 'main',
            panelLock: {panelStyle: 'main'}
          }
        ]
      }
    };
    return (
      <TicloLayoutContextType.Provider value={this}>
        <DockLayout
          defaultLayout={layout}
          ref={this.getLayout}
          groups={layoutGroups}
          style={{position: 'absolute', left: 10, top: 10, right: 10, bottom: 10}}
        />
      </TicloLayoutContextType.Provider>
    );
  }
}

class JobStorage {
  deleteJob(name: string) {}

  saveJob(name: string, job: Job, data?: DataMap) {
    console.log(JsonEsc.stringify(data));
  }

  init(root: Root): void {}
}

(async () => {
  await initEditor();
  await Root.instance.setStorage(new JobStorage());
  let reactJob = Root.instance.addJob('example', reactData);

  let generalJob = Root.instance.addJob('example0', data);

  // create some global blocks
  Root.instance._globalRoot.createBlock('^gAdd').setValue('#is', 'add');
  Root.instance._globalRoot.createBlock('^gSub').setValue('#is', 'subtract');

  let [server, client] = makeLocalConnection(Root.instance);

  ReactDOM.render(<App conn={client} />, document.getElementById('app'));
})();

(window as any).Logger = Logger;
