import type {Hono, Context} from 'hono';
import {routeRemoteStorage, type FileStorageOptions, type UserAuth} from '@ticlo/file-server';

/** Add current-user discovery and bind usr access to that identity. */
export function routeFileStorage(app: Hono, options: FileStorageOptions) {
  const prefix = (options.prefix ?? '/file').replace(/\/$/, '');
  const resolve =
    options.authProvider ?? (() => ({getUserId: () => 'anonymous', canRead: () => true, canWrite: () => true}));
  const users = new WeakMap<Context, Promise<UserAuth>>();
  const authProvider = (context: Context) => {
    let user = users.get(context);
    if (!user) {
      user = Promise.resolve(resolve(context));
      users.set(context, user);
    }
    return user;
  };
  const middleware: Parameters<Hono['use']>[1] = async (context, next) => {
    const user = await authProvider(context);
    const id = user.getUserId();
    if (!id || /[/\\\u0000]/.test(id) || id === '.' || id === '..')
      return context.json({message: 'Invalid current user'}, 500);
    if (context.req.query('op') === 'user') return context.json({id});
    const paths = [context.req.query('path'), context.req.query('dest')];
    if (context.req.path.startsWith(`${prefix}/`)) {
      try {
        paths.push(decodeURIComponent(context.req.path.slice(prefix.length + 1)));
      } catch {
        return context.json({message: 'Invalid file path'}, 400);
      }
    }
    for (const path of paths) {
      const parts = path?.replace(/^\/+/, '').split('/');
      if (parts?.[0] === 'usr' && parts[1] !== id)
        return context.json({message: 'Cannot access another user directory'}, 403);
    }
    await next();
  };
  app.use(prefix, middleware);
  app.use(`${prefix}/*`, middleware);
  routeRemoteStorage(app, {...options, authProvider});
}
