import basicAuth, { BasicAuthResult } from 'basic-auth';
import jwt, { JwtPayload } from 'jsonwebtoken';
import Koa from 'koa';
import { KoaContext } from '../koa';
import argon2 from 'argon2';

const auth = () => {
  return async (ctx: KoaContext<unknown, unknown>, next: () => void) => {
    let headerUser: BasicAuthResult | undefined;
    if (ctx.request?.headers?.authorization?.startsWith('Basic')) {
      // login and plain text password
      const basicUser = basicAuth(ctx);
      if (!basicUser) {
        return authError(ctx);
      }

      const hashedPassword = ctx.app.repositoryService.userRepository.getHashedPasswordByLogin(basicUser.name);
      if (!hashedPassword) {
        return authError(ctx);
      }
      const passwordVerified = await argon2.verify(hashedPassword, basicUser.pass);
      if (!passwordVerified) {
        return authError(ctx);
      }
      headerUser = { name: basicUser.name, pass: hashedPassword };
    } else if (ctx.request?.headers?.authorization?.startsWith('Bearer')) {
      try {
        const verifiedToken: JwtPayload = jwt.verify(
          ctx.request.headers.authorization.replace('Bearer ', ''),
          await ctx.app.encryptionService.getPublicKey(),
          {
            algorithms: ['RS256'],
            issuer: 'oibus'
          }
        ) as JwtPayload;
        if (!verifiedToken) {
          return authError(ctx);
        }
        // login and hashed password
        headerUser = { name: verifiedToken.login, pass: verifiedToken.password };
        const hashedPassword = ctx.app.repositoryService.userRepository.getHashedPasswordByLogin(headerUser.name);
        if (!hashedPassword || hashedPassword !== verifiedToken.password) {
          return authError(ctx);
        }
      } catch {
        return authError(ctx);
      }
    } else if (ctx.request?.url?.startsWith('/sse') && ctx.request?.query?.token) {
      const token = ctx.request?.query?.token as string;
      const verifiedToken: JwtPayload = jwt.verify(token, await ctx.app.encryptionService.getPublicKey(), {
        algorithms: ['RS256'],
        issuer: 'oibus'
      }) as JwtPayload;
      if (!verifiedToken) {
        return authError(ctx);
      }
      // login and hashed password
      headerUser = { name: verifiedToken.login, pass: verifiedToken.password };
      const hashedPassword = ctx.app.repositoryService.userRepository.getHashedPasswordByLogin(headerUser.name);
      if (!hashedPassword || hashedPassword !== verifiedToken.password) {
        return authError(ctx);
      }
    } else {
      if (ctx.request.url === '/api/status') {
        return next();
      }
      return authError(ctx);
    }

    if (ctx.request.url === '/api/users/current-user') {
      const currentUser = ctx.app.repositoryService.userRepository.findByLogin(headerUser.name)!;
      return ctx.ok(currentUser);
    }
    if (ctx.request.url === '/api/users/authentication') {
      const token = jwt.sign(
        // login and hashed password
        { login: headerUser.name, password: headerUser.pass },
        { key: await ctx.app.encryptionService.getPrivateKey(), passphrase: '' },
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
