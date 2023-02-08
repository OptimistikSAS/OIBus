import fs from 'node:fs/promises';
import path from 'node:path';
import pino from 'pino';
import { Buffer } from 'buffer';

/**
 * Class used to manage certificate files and their content
 */
export default class CertificateService {
  private logger: pino.Logger;
  private _privateKey: Buffer | null = null;
  private _cert: Buffer | null = null;
  private _ca: Buffer | null = null;

  constructor(logger: pino.Logger) {
    this.logger = logger;
  }

  get privateKey(): Buffer | null {
    return this._privateKey;
  }

  get cert(): Buffer | null {
    return this._cert;
  }

  get ca(): Buffer | null {
    return this._ca;
  }

  async init(options: { privateKeyFilePath?: string; certFilePath?: string; caFilePath?: string }) {
    const { privateKeyFilePath, certFilePath, caFilePath } = options;
    if (privateKeyFilePath) {
      try {
        this._privateKey = await fs.readFile(path.resolve(privateKeyFilePath));
      } catch (error) {
        this.logger.error(`Key file "${privateKeyFilePath}" does not exist: ${error}`);
      }
    }

    if (certFilePath) {
      try {
        this._cert = await fs.readFile(path.resolve(certFilePath));
      } catch (error) {
        this.logger.error(`Cert file "${certFilePath}" does not exist: ${error}`);
      }
    }

    if (caFilePath) {
      try {
        this._ca = await fs.readFile(path.resolve(caFilePath));
      } catch (error) {
        this.logger.error(`CA file "${caFilePath}" does not exist: ${error}`);
      }
    }
  }
}
