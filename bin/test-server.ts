import Express from 'express';
import yargs from 'yargs';
import {Root} from '../src/core';
import '../src/test';
import '../src/node';
import {connectTiclo, routeTiclo, getEditorUrl} from '../src/express';
import {TestLoader} from '../src/node/test-loader/TestLoader';
import {TestRunner} from '../src/test/TestRunner';
import type {FlowTestGroup} from '../src/test/FlowTestGroup';

const packagesToTest = ['./src/core', './src/express', './src/node', './src/http'];

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
        default: 8018,
        describe: 'Port of the server',
        type: 'number',
      },
    })
    .help();
  let argv = parser.parse();

  await Root.instance.setStorage(new TestLoader(packagesToTest));

  let app = Express();
  if (argv.serve) {
    connectTiclo(app, '/ticlo');
  }
  routeTiclo(app, '/ticlo');

  app.get('/', (req, res) => {
    res.end();
  });

  let server = app.listen(argv.port, () => {
    console.log(`listening on ${argv.port}`);
    if (argv.serve) {
      console.log(getEditorUrl(`ws://127.0.0.1:${argv.port}/ticlo`, 'example'));
    }
  });

  if (argv.run) {
    let testRunner = new TestRunner(Root.instance.getValue('tests') as FlowTestGroup, () => {
      if (argv.quitOnFinish || (argv.quitOnSuccess && testRunner.failed === 0)) {
        if (testRunner.failed > 0) {
          process.exit(3);
        } else {
          process.exit(0);
        }
      }
    });
    testRunner.run();
  } else if (!argv.serve) {
    console.error('at least one of these flag is needed: --run , --serve ');
    process.exit(1);
  }
})();
