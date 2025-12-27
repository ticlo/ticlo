import Fastify from 'fastify';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import {Root} from '@ticlo/core';
import '../../packages/test/index.js';
import '../../packages/node/index.js';
import {connectTiclo, routeTiclo, getEditorUrl} from '@ticlo/web-server/server.js';
import {TestLoader} from '@ticlo/node/test-loader/TestLoader.js';
import {TestRunner} from '@ticlo/test/TestRunner.js';
import type {FlowTestGroup} from '@ticlo/test/FlowTestGroup.js';

const packagesToTest = ['packages/core', 'packages/web-server', 'packages/node'];

(async () => {
  let parser = yargs(hideBin(process.argv))
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

  // Create Fastify instance (HTTP/1.1 for test server compatibility)
  const app = Fastify({
    logger: false,
  });

  // CORS middleware
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Headers', 'content-type');
  });

  if (serve) {
    await connectTiclo(app, '/ticlo');
  }
  await routeTiclo(app, '/api');

  let globalClientBlock = Root.instance._globalRoot.createBlock('^local-client');
  globalClientBlock._load({'#is': 'http:client', 'url': `http://127.0.0.1:${port}/api/`});

  app.get('/', async (request, reply) => {
    return '';
  });

  try {
    await app.listen({port, host: '127.0.0.1'});
    console.log(`listening on ${port}`);
    if (serve) {
      console.log(getEditorUrl(`ws://127.0.0.1:${port}/ticlo`, 'example'));
    }

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
