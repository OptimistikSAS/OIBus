import basicAuth, { BasicAuthResult } from 'basic-auth';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import UserService from '../../service/user.service';
import EncryptionService from '../../service/encryption.service';

interface AuthConfig {
  userService: UserService;
  encryptionService: EncryptionService;
}

// Helper function for authentication errors
const createAuthError = (res: Response, message = 'Unauthorized', status = 401) => {
  const realm = 'Secure Area';
  res.set(
    'WWW-Authenticate',
    `Basic realm="${realm
      .replace(/\\/g, '\\\\') // escape \
      .replace(/"/g, '\\"')}"` // escape "
  );
  return res.status(status).json({
    error: message,
    status: status
  });
};

const createAuthMiddleware = (config: AuthConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let headerUser: BasicAuthResult | undefined;
      // Basic Auth
      if (req.headers?.authorization?.startsWith('Basic')) {
        const basicUser = basicAuth(req);
        if (!basicUser || !basicUser.name || !basicUser.pass) {
          return createAuthError(res);
        }

        const hashedPassword = config.userService.getHashedPasswordByLogin(basicUser.name);
        if (!hashedPassword) {
          return createAuthError(res);
        }

        const passwordVerified = await argon2.verify(hashedPassword, basicUser.pass);
        if (!passwordVerified) {
          return createAuthError(res);
        }

        headerUser = { name: basicUser.name, pass: hashedPassword };
      }
      // Bearer Token Auth
      else if (req.headers?.authorization?.startsWith('Bearer')) {
        try {
          const token = req.headers.authorization.replace('Bearer ', '');
          const verifiedToken: JwtPayload = jwt.verify(token, await config.encryptionService.getPublicKey(), {
            algorithms: ['RS256'],
            issuer: 'oibus'
          }) as JwtPayload;

          if (!verifiedToken?.login) {
            return createAuthError(res);
          }

          headerUser = { name: verifiedToken.login, pass: verifiedToken.password };
          const hashedPassword = config.userService.getHashedPasswordByLogin(headerUser.name);

          if (!hashedPassword || hashedPassword !== verifiedToken.password) {
            return createAuthError(res);
          }
        } catch {
          return createAuthError(res, 'Invalid token', 403);
        }
      }
      // SSE Token Auth
      else if (req.url?.startsWith('/sse') && req.query?.token) {
        try {
          const token = req.query.token as string;
          const verifiedToken: JwtPayload = jwt.verify(token, await config.encryptionService.getPublicKey(), {
            algorithms: ['RS256'],
            issuer: 'oibus'
          }) as JwtPayload;

          if (!verifiedToken?.login) {
            return createAuthError(res);
          }

          headerUser = { name: verifiedToken.login, pass: verifiedToken.password };
          const hashedPassword = config.userService.getHashedPasswordByLogin(headerUser.name);

          if (!hashedPassword || hashedPassword !== verifiedToken.password) {
            return createAuthError(res);
          }
        } catch {
          return createAuthError(res, 'Invalid token', 403);
        }
      }
      // No auth provided
      else {
        return createAuthError(res);
      }

      // Handle current user endpoint
      if (req.path === '/api/users/current-user') {
        const currentUser = config.userService.findByLogin(headerUser.name);
        if (!currentUser) {
          return createAuthError(res, 'User not found', 404);
        }
        return res.status(200).json(currentUser);
      }

      // Handle current user endpoint
      if (req.url === '/api/users/current-user') {
        const currentUser = config.userService.findByLogin(headerUser.name)!;
        return res.status(200).json(currentUser);
      }

      // Handle authentication endpoint
      if (req.path === '/api/users/authentication') {
        const token = jwt.sign(
          { login: headerUser.name, password: headerUser.pass },
          { key: await config.encryptionService.getPrivateKey(), passphrase: '' },
          {
            algorithm: 'RS256',
            expiresIn: '7d',
            issuer: 'oibus'
          }
        );
        return res.status(200).json({ access_token: token });
      }

      return next();
    } catch (err) {
      console.error('Authentication error:', err);
      return createAuthError(res, 'Authentication failed', 500);
    }
  };
};

// Factory function to create the middleware with dependencies
export const authMiddleware = (userService: UserService, encryptionService: EncryptionService) => {
  return createAuthMiddleware({ userService, encryptionService });
};

export default authMiddleware;
