import {serve as serveHono} from '@hono/node-server';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {Root} from '@ticlo/core';
import '../../packages/test/index.js';
import '../../packages/node/index.js';
import {createTicloApp, getEditorUrl} from '@ticlo/web-server/server.js';
import {TestLoader} from '@ticlo/node/test-loader/TestLoader.js';
import {TestRunner} from '@ticlo/test/TestRunner.js';
import type {FlowTestGroup} from '@ticlo/test/FlowTestGroup.js';

const packagesToTest = ['packages/core', 'packages/web-server', 'packages/node'];

(async () => {
  const parser = yargs(hideBin(process.argv))
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
  const {onDemandLoad, serve, port, run, quitOnSuccess, quitOnFinish} = parser.parse() as any;

  await Root.instance.setStorage(new TestLoader(packagesToTest, {onDemandLoad}));

  const {app, ticloWs} = await createTicloApp({enableEditor: serve});

  const globalClientBlock = Root.instance._globalRoot.createBlock('^local-client');
  globalClientBlock._load({'#is': 'http:client', 'url': `http://127.0.0.1:${port}/api/`});

  try {
    const server = serveHono({fetch: app.fetch, port, hostname: '127.0.0.1'});
    ticloWs?.injectWebSocket(server);
    server.on('listening', () => {
      console.log(`listening on ${port}`);
      if (serve) {
        console.log(getEditorUrl(`ws://127.0.0.1:${port}/ticlo`, 'example'));
      }
    });
    server.on('error', (err) => {
      console.error('Server failed to start:', err);
      process.exit(1);
    });

    if (run) {
      const testRunner = new TestRunner(
        Root.instance.getValue('tests') as FlowTestGroup,
        () => {
          if (quitOnFinish || (quitOnSuccess && testRunner.failed === 0)) {
            if (testRunner.failed > 0) {
              process.exit(3);
            } else {
              process.exit(0);
            }
          } else {
            console.log('tests are finished, waiting for updates, press Ctrl+C to exit');
          }
        },
        serve // allow editing when editing server is enabled
      );
      testRunner.run();
    } else if (!serve) {
      console.error('at least one of these flag is needed: --run , --serve ');
      process.exit(1);
    }
  } catch (err) {
    console.error('Server failed to start:', err);
    process.exit(1);
  }
})();
