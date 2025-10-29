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

const createAuthMiddleware = (config: AuthConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    let headerUser: BasicAuthResult | undefined;

    // Helper function for authentication errors
    const authError = () => {
      const realm = 'Secure Area';
      res.set(
        'WWW-Authenticate',
        `Basic realm="${realm
          .replace(/\\/g, '\\\\') // escape \
          .replace(/"/g, '\\"')}"`
      ); // escape "
      return res.status(403).send('Unauthorized');
    };

    try {
      // Basic Auth
      if (req.headers?.authorization?.startsWith('Basic')) {
        const basicUser = basicAuth(req);
        if (!basicUser) {
          return authError();
        }

        const hashedPassword = config.userService.getHashedPasswordByLogin(basicUser.name);
        if (!hashedPassword) {
          return authError();
        }

        const passwordVerified = await argon2.verify(hashedPassword, basicUser.pass);
        if (!passwordVerified) {
          return authError();
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

          if (!verifiedToken) {
            return authError();
          }

          headerUser = { name: verifiedToken.login, pass: verifiedToken.password };
          const hashedPassword = config.userService.getHashedPasswordByLogin(headerUser.name);
          if (!hashedPassword || hashedPassword !== verifiedToken.password) {
            return authError();
          }
        } catch {
          return authError();
        }
      }
      // SSE Token Auth
      else if (req.url?.startsWith('/sse') && req.query?.token) {
        const token = req.query.token as string;
        const verifiedToken: JwtPayload = jwt.verify(token, await config.encryptionService.getPublicKey(), {
          algorithms: ['RS256'],
          issuer: 'oibus'
        }) as JwtPayload;

        if (!verifiedToken) {
          return authError();
        }

        headerUser = { name: verifiedToken.login, pass: verifiedToken.password };
        const hashedPassword = config.userService.getHashedPasswordByLogin(headerUser.name);
        if (!hashedPassword || hashedPassword !== verifiedToken.password) {
          return authError();
        }
      }
      // No auth provided
      else {
        if (req.url === '/api/status') {
          return next();
        }
        return authError();
      }

      // Handle current user endpoint
      if (req.url === '/api/users/current-user') {
        const currentUser = config.userService.findByLogin(headerUser.name)!;
        return res.status(200).json(currentUser);
      }

      // Handle authentication endpoint
      if (req.url === '/api/users/authentication') {
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
    } catch {
      return authError();
    }
  };
};

// Factory function to create the middleware with dependencies
export const authMiddleware = (userService: UserService, encryptionService: EncryptionService) => {
  return createAuthMiddleware({ userService, encryptionService });
};

export default authMiddleware;
