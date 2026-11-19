import crypto from 'node:crypto';

import basicAuth, { BasicAuthResult } from 'basic-auth';
import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

import { encryptionService } from '../../service/encryption.service';
import type OIBusService from '../../service/oibus.service';
import UserService from '../../service/user.service';
import { CustomExpressRequest } from '../express';
import AuthenticationLimiter from './authentication-limiter';

interface AuthConfig {
  userService: UserService;
  oIBusService: OIBusService;
  authenticationLimiter: AuthenticationLimiter;
}

/**
 * Fingerprint of the password hash of a user, carried by the tokens: a password change changes the hash (its salt is
 * random), which invalidates the tokens issued before. The hash itself, which holds the salt, never leaves OIBus: the
 * fingerprint cannot be used to test passwords offline.
 */
export const passwordFingerprint = (hashedPassword: string): string =>
  crypto.createHash('sha256').update(hashedPassword).digest('base64url');

/**
 * The requests a user who must change their password can still make: changing it, and reading the OIBus information
 * shown around the form (the current user is answered before)
 */
const isAllowedBeforePasswordChange = (req: Request, userId: string): boolean =>
  (req.method === 'GET' && req.path === '/api/engine/info') || (req.method === 'POST' && req.path === `/api/users/${userId}/password`);

// Helper function for authentication errors
const createAuthError = (res: Response, message = 'Unauthorized', status = 401, challenge = true) => {
  if (challenge) {
    const realm = 'Secure Area';
    res.set(
      'WWW-Authenticate',
      `Basic realm="${realm
        .replace(/\\/g, '\\\\') // escape \
        .replace(/"/g, '\\"')}"` // escape "
    );
  } else {
    res.removeHeader('WWW-Authenticate');
  }
  return res.status(status).json({
    error: message,
    status: status
  });
};

const createAuthMiddleware = (config: AuthConfig) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const shouldChallenge = req.path !== '/api/users/authentication';
    const unauthorizedStatus = shouldChallenge ? 401 : 403;
    const unauthorizedMessage = shouldChallenge ? 'Unauthorized' : 'Invalid credentials';
    try {
      let headerUser: BasicAuthResult | undefined;
      // Basic Auth
      if (req.headers?.authorization?.startsWith('Basic')) {
        const basicUser = basicAuth(req);
        if (!basicUser || !basicUser.name || !basicUser.pass) {
          return createAuthError(res, unauthorizedMessage, unauthorizedStatus, shouldChallenge);
        }

        // Checked before verifying the password: a blocked address or login does not cost a password verification
        const ip = req.ip ?? '';
        const retryAfter = config.authenticationLimiter.retryAfter(ip, basicUser.name);
        if (retryAfter > 0) {
          res.set('Retry-After', retryAfter.toString());
          return createAuthError(res, 'Too many failed authentications, try again later', 429, false);
        }

        const passwordVerified = await config.userService.verifyPassword(basicUser.name, basicUser.pass);
        const hashedPassword = config.userService.getHashedPasswordByLogin(basicUser.name);
        if (!passwordVerified || !hashedPassword) {
          config.authenticationLimiter.recordFailure(ip, basicUser.name);
          return createAuthError(res, unauthorizedMessage, unauthorizedStatus, shouldChallenge);
        }

        headerUser = { name: basicUser.name, pass: hashedPassword };
      }
      // Bearer Token Auth
      else if (req.headers?.authorization?.startsWith('Bearer')) {
        try {
          const token = req.headers.authorization.replace('Bearer ', '');
          const verifiedToken: JwtPayload = jwt.verify(token, encryptionService.getTokenSecret(), {
            algorithms: ['HS256'],
            issuer: 'oibus'
          }) as JwtPayload;

          if (!verifiedToken?.login) {
            return createAuthError(res, unauthorizedMessage, unauthorizedStatus, shouldChallenge);
          }

          const hashedPassword = config.userService.getHashedPasswordByLogin(verifiedToken.login);
          if (!hashedPassword || passwordFingerprint(hashedPassword) !== verifiedToken.passwordFingerprint) {
            return createAuthError(res, unauthorizedMessage, unauthorizedStatus, shouldChallenge);
          }
          headerUser = { name: verifiedToken.login, pass: hashedPassword };
        } catch {
          return createAuthError(res, 'Invalid token', 403, shouldChallenge);
        }
      }
      // No auth provided
      else {
        return createAuthError(res, unauthorizedMessage, unauthorizedStatus, shouldChallenge);
      }

      // Handle current user endpoint
      if (req.path === '/api/users/current-user') {
        const currentUser = config.userService.findByLogin(headerUser.name);
        if (!currentUser) {
          return createAuthError(res, 'User not found', 404, shouldChallenge);
        }
        return res.status(200).json(currentUser);
      }

      // Handle authentication endpoint
      if (req.path === '/api/users/authentication') {
        const authTokenDuration = config.oIBusService.getEngineSettings().webServer.authTokenDuration;
        const token = jwt.sign(
          { login: headerUser.name, passwordFingerprint: passwordFingerprint(headerUser.pass) },
          encryptionService.getTokenSecret(),
          {
            algorithm: 'HS256',
            expiresIn: authTokenDuration,
            issuer: 'oibus'
          }
        );
        return res.status(200).json({ access_token: token });
      }

      const currentUser = config.userService.findByLogin(headerUser.name);
      if (currentUser.mustChangePassword && !isAllowedBeforePasswordChange(req, currentUser.id)) {
        return createAuthError(res, 'The password must be changed first', 403, false);
      }
      (req as CustomExpressRequest).user = { id: currentUser.id, login: currentUser.login };
      return next();
    } catch (err) {
      console.error('Authentication error:', err);
      return createAuthError(res, 'Authentication failed', 500, shouldChallenge);
    }
  };
};

// Factory function to create the middleware with dependencies
export const authMiddleware = (userService: UserService, oIBusService: OIBusService, authenticationLimiter: AuthenticationLimiter) => {
  return createAuthMiddleware({ userService, oIBusService, authenticationLimiter });
};

export default authMiddleware;
