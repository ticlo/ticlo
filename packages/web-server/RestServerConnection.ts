import {FastifyRequest, FastifyReply} from 'fastify';
import {ServerConnection, DataMap, Logger, decode, encode, decodeReviver} from '@ticlo/core';

export class RestServerConnection extends ServerConnection {
  onHttpPost = async (req: FastifyRequest, res: FastifyReply) => {
    try {
      // Parse JSON body with reviver
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body, decodeReviver);
      }

      const request = body;
      const cmd = request?.cmd as string;

      if (typeof cmd === 'string' && Object.hasOwn(ServerConnection.prototype, cmd)) {
        let func: Function = (this as any)[cmd];
        if (typeof func === 'function' && func.length === 1 && !cmd.startsWith('on')) {
          const result = func.call(this, request);
          if (result) {
            if (typeof result === 'string') {
              return res.send({cmd: 'error', msg: result});
            } else {
              return res.send(encode(result));
            }
          } else {
            return res.send('');
          }
        }
      } else {
        return res.code(400).send();
      }
    } catch (error) {
      return res.code(400).send();
    }
  };

  onHttpGetFile = async (req: FastifyRequest, res: FastifyReply) => {
    console.log('getfile');
    return res.code(402).send();
  };
}
