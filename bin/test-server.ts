import Express from 'express';
import yargs from 'yargs';
import {Root} from '../src/core';
import '../src/test';
import '../src/node';
import {connectTiclo, routeTiclo, getEditorUrl} from '../src/express';
import {TestLoader} from '../src/node/test-loader/TestLoader';
import {TestRunner} from '../src/test/TestRunner';
import type {FlowTestGroup} from '../src/test/FlowTestGroup';

const packagesToTest = ['./src/core', './src/express', './src/node', './src/server'];

(async () => {
  let parser = yargs
    .options({
      run: {
        default: false,
        describe: 'Run tests automatically',
        type: 'boolean',
      },
      serve: {
        default: false,
        describe: 'Start the test server',
        type: 'boolean',
      },
      onDemandLoad: {
        default: false,
        describe: 'Load test when its enabled, and unload it when disabled',
        type: 'boolean',
      },
      quitOnFinish: {
        default: false,
        describe: 'End the test process when all tests are finished',
        type: 'boolean',
      },
      quitOnSuccess: {
        default: false,
        describe: 'End the test process when all tests are passes',
        type: 'boolean',
      },
      port: {
        default: 8010,
        describe: 'Port of the server',
        type: 'number',
      },
    })
    .help();
  let {onDemandLoad, serve, port, run, quitOnSuccess, quitOnFinish} = parser.parse() as any;

  await Root.instance.setStorage(new TestLoader(packagesToTest, {onDemandLoad}));

  let app = Express();
  if (serve) {
    connectTiclo(app, '/ticlo');
  }
  routeTiclo(app, '/ticlo');

  app.get('/', (req, res) => {
    res.end();
  });

  let server = app.listen(port, () => {
    console.log(`listening on ${port}`);
    if (serve) {
      console.log(getEditorUrl(`ws://127.0.0.1:${port}/ticlo`, 'example'));
    }
  });

  if (run) {
    let testRunner = new TestRunner(
      Root.instance.getValue('tests') as FlowTestGroup,
      () => {
        if (quitOnFinish || (quitOnSuccess && testRunner.failed === 0)) {
          if (testRunner.failed > 0) {
            process.exit(3);
          } else {
            process.exit(0);
          }
        }
      },
      serve // allow editing when editing server is enabled
    );
    testRunner.run();
  } else if (!serve) {
    console.error('at least one of these flag is needed: --run , --serve ');
    process.exit(1);
  }
})();
