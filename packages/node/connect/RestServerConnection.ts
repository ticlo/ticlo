import {FastifyRequest, FastifyReply} from 'fastify';
import {ServerConnection, DataMap, Logger, decode, encode, decodeReviver} from '@ticlo/core';

export class RestServerConnection extends ServerConnection {
  onHttpPost = async (req: FastifyRequest, res: FastifyReply) => {
    try {
      // Parse JSON body with decodeReviver
      let request: any;
      if (typeof req.body === 'string') {
        request = JSON.parse(req.body, decodeReviver);
      } else {
        request = req.body;
      }

      const cmd = request?.cmd as string;
      if (typeof cmd === 'string' && Object.hasOwn(ServerConnection.prototype, cmd)) {
        const func: Function = (this as any)[cmd];
        if (typeof func === 'function' && func.length === 1 && !cmd.startsWith('on')) {
          const result = func.call(this, request);
          if (result) {
            if (typeof result === 'string') {
              return res.send({cmd: 'error', msg: result});
            } else {
              res.header('Content-Type', 'application/json');
              return res.send(encode(result));
            }
          } else {
            return res.send('');
          }
        }
      } else {
        return res.status(400).send('');
      }
    } catch (error) {
      return res.status(400).send('');
    }
  };

  onHttpGetFile = async (req: FastifyRequest, res: FastifyReply) => {
    console.log('getfile');
    return res.status(402).send('');
  };
}
