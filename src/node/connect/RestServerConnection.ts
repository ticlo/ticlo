import {Request, Response, json as expressJson} from 'express';
import {ServerConnection, DataMap, Logger, decode, encode, decodeReviver} from '@ticlo/core';

const parseArrowJson = expressJson({reviver: decodeReviver});

export class RestServerConnection extends ServerConnection {
  onHttpPost = (req: Request, res: Response) => {
    parseArrowJson(req, res, () => {
      const request = req.body;
      const cmd = request?.cmd as string;
      if (typeof cmd === 'string' && ServerConnection.prototype.hasOwnProperty(cmd)) {
        let func: Function = (this as any)[cmd];
        if (typeof func === 'function' && func.length === 1 && !cmd.startsWith('on')) {
          const result = func.call(this, request);
          if (result) {
            if (typeof result === 'string') {
              res.json({cmd: 'error', msg: result});
              res.end();
            } else {
              res.send(encode(result));
              res.end();
            }
          } else {
            res.end();
          }
        }
      }
    });
  };
  onHttpGet = (req: Request, res: Response) => {
    console.log('get', req);
  };
}
