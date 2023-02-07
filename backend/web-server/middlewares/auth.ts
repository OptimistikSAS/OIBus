import basicAuth, { BasicAuthResult } from 'basic-auth';
import jwt from 'jsonwebtoken';
import Koa from 'koa';
import bcrypt from 'bcrypt';
import { SALT } from '../../repository/utils';
import { KoaContext } from '../koa';

const auth = () => {
  return async (ctx: KoaContext<any, any>, next: () => Promise<any>) => {
    let headerUser: BasicAuthResult | undefined;
    if (ctx.request?.headers?.authorization?.startsWith('Basic')) {
      const basicUser = basicAuth(ctx as any);
      if (!basicUser) {
        return authError(ctx);
      }
      headerUser = { name: basicUser.name, pass: await bcrypt.hash(basicUser.pass, SALT) };
    } else if (ctx.request?.headers?.authorization?.startsWith('Bearer')) {
      try {
        const verifiedToken: any = jwt.verify(
          ctx.request.headers.authorization.replace('Bearer ', ''),
          ctx.app.encryptionService.publicKey,
          {
            algorithms: ['RS256'],
            issuer: 'oibus'
          }
        );
        if (!verifiedToken) {
          return authError(ctx);
        }
        headerUser = { name: verifiedToken.login, pass: verifiedToken.password };
      } catch {
        return authError(ctx);
      }
    } else {
      return authError(ctx);
    }

    const user = ctx.app.repositoryService.userRepository.getUserByLogin(headerUser.name);
    if (!user || user.password !== headerUser.pass) {
      return authError(ctx);
    }

    if (ctx.request.url === '/api/users/current-user') {
      return ctx.ok(user);
    }
    if (ctx.request.url === '/api/users/authentication') {
      const token = jwt.sign(
        { login: user.login, password: user.password },
        { key: ctx.app.encryptionService.privateKey, passphrase: '' },
        {
          algorithm: 'RS256',
          expiresIn: '7d',
          issuer: 'oibus'
        }
      );
      return ctx.ok({ access_token: token });
    }
    return next();
  };
};

const authError = (ctx: Koa.BaseContext) => {
  const realm = 'Secure Area';
  return ctx.throw(403, 'Unauthorized', {
    headers: {
      'WWW-Authenticate': `Basic realm="${realm
        .replace(/\\/g, '\\\\') // escape \
        .replace(/"/g, '\\"')}"` // escape "
    }
  });
};

export default auth;
