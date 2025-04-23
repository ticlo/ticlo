import Express from 'express';
import yargs from 'yargs';
import {Root} from '@ticlo/core';
import '../src/test';
import '../src/node';
import {connectTiclo, routeTiclo, getEditorUrl} from '@ticlo/web-server';
import {TestLoader} from '@ticlo/node/test-loader/TestLoader';
import {TestRunner} from '@ticlo/test/TestRunner';
import type {FlowTestGroup} from '@ticlo/test/FlowTestGroup';

const packagesToTest = ['./src/core', './src/web-server', './src/node'];

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
  app.all('/*aPath', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'content-type');
    next();
  });
  if (serve) {
    connectTiclo(app, '/ticlo');
  }
  routeTiclo(app, '/api');

  let globalClientBlock = Root.instance._globalRoot.createBlock('^local-client');
  globalClientBlock._load({'#is': 'http:client', 'url': `http://127.0.0.1:${port}/api/`});

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
