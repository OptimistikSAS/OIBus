import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { DateTime } from 'luxon';

import {
  OIBusArrayAttribute,
  OIBusObjectAttribute,
  OIBusSecretAttribute,
  OIBusStringAttribute
} from '../../shared/model/connector/form.model';

import testData from '../tests/utils/test-data';
import EncryptionService from './encryption.service';

const encryptionService = new EncryptionService();

const securityKey = Buffer.from('0123456789abcdef0123456789abcdef');
const tokenSecret = Buffer.from('fedcba9876543210fedcba9876543210');
const cryptoSettings = {
  securityKey: securityKey.toString('base64'),
  tokenSecret: tokenSecret.toString('base64')
};

const manifest: OIBusObjectAttribute = {
  type: 'object',
  attributes: [
    {
      key: 'field1',
      type: 'string',
      translationKey: 'Field 1'
    } as OIBusStringAttribute,
    {
      key: 'field2',
      type: 'secret',
      translationKey: 'Field 2'
    } as OIBusSecretAttribute,
    {
      key: 'field3',
      type: 'string',
      translationKey: 'Field 3'
    } as OIBusStringAttribute,
    {
      key: 'field4',
      type: 'array',
      translationKey: 'Field 4',
      paginate: false,
      numberOfElementPerPage: 0,
      rootAttribute: {
        type: 'object',
        attributes: [
          {
            key: 'fieldArray1',
            type: 'string',
            translationKey: 'Field array 1'
          } as OIBusStringAttribute,
          {
            key: 'fieldArray2',
            type: 'secret',
            translationKey: 'Field array 2'
          } as OIBusSecretAttribute,
          {
            key: 'fieldArray3',
            type: 'secret',
            translationKey: 'Field array 3'
          } as OIBusSecretAttribute
        ]
      } as OIBusObjectAttribute
    } as OIBusArrayAttribute,
    {
      key: 'field5',
      type: 'object',
      translationKey: 'Field 5',
      attributes: [
        {
          key: 'fieldGroup1',
          type: 'string',
          translationKey: 'Field group 1'
        } as OIBusStringAttribute,
        {
          key: 'fieldGroup2',
          type: 'secret',
          translationKey: 'Field group 2'
        } as OIBusSecretAttribute
      ]
    } as OIBusObjectAttribute
  ]
} as OIBusObjectAttribute;

// Settings matching the manifest above, with all their secrets set
const secretSettings = {
  field1: 'not a secret',
  field2: 'secret',
  field3: 'not a secret',
  field4: [
    { fieldArray1: 'not an array secret', fieldArray2: 'an array secret' },
    { fieldArray1: 'not an array secret', fieldArray2: 'another array secret' }
  ],
  field5: {
    fieldGroup1: 'not a group secret',
    fieldGroup2: 'a group secret'
  }
};
// The same settings once their secrets went through a cipher returning 'encrypted secret'
const encryptedSettings = {
  field1: 'not a secret',
  field2: 'encrypted secret',
  field3: 'not a secret',
  field4: [
    { fieldArray1: 'not an array secret', fieldArray2: 'encrypted secret', fieldArray3: '' },
    { fieldArray1: 'not an array secret', fieldArray2: 'encrypted secret', fieldArray3: '' }
  ],
  field5: {
    fieldGroup1: 'not a group secret',
    fieldGroup2: 'encrypted secret'
  }
};

describe('Encryption Service', () => {
  let privateDecryptMock: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    encryptionService.init(cryptoSettings);
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
    privateDecryptMock = mock.method(crypto, 'privateDecrypt', () => Buffer.from(''));
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should keep the settings read in crypto.db, and give the secret signing the tokens', () => {
    assert.deepStrictEqual(encryptionService.storedSettings, cryptoSettings);
    assert.deepStrictEqual(encryptionService.getTokenSecret(), tokenSecret);
  });

  it('should not give the secret signing the tokens when not initialized', () => {
    encryptionService['initialized'] = false;
    assert.throws(() => encryptionService.getTokenSecret(), { message: 'EncryptionService not initialized' });
  });

  it('should encrypt a text with AES-256-GCM and a random nonce', () => {
    const encryptedText = encryptionService.encryptText('text to encrypt');
    const otherEncryptedText = encryptionService.encryptText('text to encrypt');

    // nonce (12 bytes) | ciphertext (as long as the text) | authentication tag (16 bytes)
    assert.strictEqual(Buffer.from(encryptedText, 'base64').length, 12 + 'text to encrypt'.length + 16);
    assert.notStrictEqual(encryptedText, otherEncryptedText);
    assert.strictEqual(encryptionService.decryptText(encryptedText), 'text to encrypt');
    assert.strictEqual(encryptionService.decryptText(otherEncryptedText), 'text to encrypt');
  });

  it('should encrypt with a key derived from the stored key, not the stored key itself', () => {
    const data = Buffer.from(encryptionService.encryptText('text to encrypt'), 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', securityKey, data.subarray(0, 12));
    decipher.setAuthTag(data.subarray(data.length - 16));
    decipher.update(data.subarray(12, data.length - 16));

    assert.throws(() => decipher.final(), { message: 'Unsupported state or unable to authenticate data' });
  });

  it('should properly encrypt and decrypt empty input', () => {
    assert.strictEqual(encryptionService.encryptText(''), '');
    assert.strictEqual(encryptionService.encryptText(null), '');
    assert.strictEqual(encryptionService.decryptText(''), '');
    assert.strictEqual(encryptionService.decryptText(undefined), '');
  });

  it('should throw error on encrypt when class is not initialized', () => {
    encryptionService['initialized'] = false;
    assert.throws(() => encryptionService.encryptText('test'), { message: 'EncryptionService not initialized' });
  });

  it('should refuse to decrypt an altered text', () => {
    const data = Buffer.from(encryptionService.encryptText('text to encrypt'), 'base64');
    data[14] ^= 1;

    assert.throws(() => encryptionService.decryptText(data.toString('base64')), {
      message: 'Unsupported state or unable to authenticate data'
    });
  });

  it('should refuse to decrypt a text too short to hold a nonce and a tag', () => {
    assert.throws(() => encryptionService.decryptText(Buffer.alloc(27).toString('base64')), {
      message: 'Invalid encrypted text'
    });
  });

  it('should refuse to decrypt a text not encrypted with its key', () => {
    const cipher = crypto.createCipheriv('aes-256-cbc', securityKey, Buffer.alloc(16));
    const otherText = cipher.update('a secret encrypted before OIBus 4.0', 'utf8', 'base64') + cipher.final('base64');

    assert.throws(() => encryptionService.decryptText(otherText), { message: 'Unsupported state or unable to authenticate data' });
  });

  it('should throw error on decrypt when class is not initialized', () => {
    encryptionService['initialized'] = false;
    assert.throws(() => encryptionService.decryptText('test'), { message: 'EncryptionService not initialized' });
  });

  it('should properly encrypt connector secrets', async () => {
    const previousSettings = { field1: 'not a secret', field2: 'secret', field3: 'not a secret' };
    mock.method(encryptionService, 'encryptText', () => 'encrypted secret');

    assert.deepStrictEqual(
      encryptionService.encryptConnectorSecrets<Record<string, unknown>>(secretSettings, previousSettings, manifest),
      encryptedSettings
    );
  });

  it('should properly encrypt connector secrets when no secret provided', async () => {
    mock.method(encryptionService, 'encryptText', () => 'encrypted secret');

    assert.deepStrictEqual(encryptionService.encryptConnectorSecrets(secretSettings, null, manifest), encryptedSettings);
  });

  it('should properly keep existing and encrypted connector secrets', async () => {
    const newSettings = {
      field1: 'not a secret',
      field2: '',
      field3: 'not a secret',
      field4: [
        { fieldArray1: 'not an array secret', fieldArray2: 'an array secret', fieldArray3: null },
        { fieldArray1: 'not an array secret', fieldArray2: 'another array secret' }
      ],
      field5: {
        fieldGroup1: 'not a group secret',
        fieldGroup2: ''
      }
    };
    const previousSettings = {
      field1: 'not a secret',
      field2: 'encrypted secret',
      field3: 'not a secret',
      field4: [
        { fieldArray1: 'not an array secret', fieldArray2: 'encrypted secret' },
        { fieldArray1: 'not an array secret', fieldArray2: 'encrypted secret' }
      ],
      field5: {
        fieldGroup1: 'not a group secret',
        fieldGroup2: 'a group secret'
      }
    };
    mock.method(encryptionService, 'encryptText', () => 'encrypted secret');

    assert.deepStrictEqual(encryptionService.encryptConnectorSecrets<Record<string, unknown>>(newSettings, previousSettings, manifest), {
      ...encryptedSettings,
      field5: { fieldGroup1: 'not a group secret', fieldGroup2: 'a group secret' }
    });
  });

  it('should properly decrypt connector secrets', async () => {
    mock.method(encryptionService, 'decryptText', () => 'encrypted secret');

    assert.deepStrictEqual(encryptionService.decryptConnectorSecrets(secretSettings, manifest), encryptedSettings);
  });

  it('should properly filter out secret', () => {
    const settings = { ...secretSettings, field2: 'encrypted secret' };

    assert.deepStrictEqual(encryptionService.filterSecrets(settings, manifest), {
      field1: 'not a secret',
      field2: '',
      field3: 'not a secret',
      field4: [
        { fieldArray1: 'not an array secret', fieldArray2: '', fieldArray3: '' },
        { fieldArray1: 'not an array secret', fieldArray2: '', fieldArray3: '' }
      ],
      field5: {
        fieldGroup1: 'not a group secret',
        fieldGroup2: ''
      }
    });
  });

  it('should properly decrypt connector secrets with private key', async () => {
    privateDecryptMock.mock.mockImplementation(() => Buffer.from('encrypted secret'));

    assert.deepStrictEqual(encryptionService.decryptSecretsWithPrivateKey(secretSettings, manifest, ['private key']), encryptedSettings);
  });

  it('should decrypt a text with the previous private key when the current one fails', () => {
    privateDecryptMock.mock.mockImplementation((options: { key: string }) => {
      if (options.key === 'current key') throw new Error('oaep decoding error');
      return Buffer.from('secret');
    });

    assert.strictEqual(encryptionService.decryptTextWithPrivateKey('encrypted', ['current key', 'previous key']), 'secret');
    assert.deepStrictEqual(
      privateDecryptMock.mock.calls.map(call => (call.arguments[0] as { key: string }).key),
      ['current key', 'previous key']
    );
  });

  it('should throw the last error when no private key decrypts the text', () => {
    privateDecryptMock.mock.mockImplementation((options: { key: string }) => {
      throw new Error(`cannot decrypt with ${options.key}`);
    });

    assert.throws(() => encryptionService.decryptTextWithPrivateKey('encrypted', ['current key', 'previous key']), {
      message: 'cannot decrypt with previous key'
    });
    assert.throws(() => encryptionService.decryptTextWithPrivateKey('encrypted', []), { message: 'No private key to decrypt the text' });
  });

  it('should generate a self-signed certificate with its RSA key pair', async () => {
    const result = await encryptionService.generateSelfSignedCertificate({
      commonName: 'Test CN',
      countryName: 'FR',
      stateOrProvinceName: 'Savoie',
      localityName: 'Chambery',
      organizationName: 'Test Org',
      keySize: 2048,
      daysBeforeExpiry: 365
    });

    // the same PEM formats as node-forge exported them
    assert.match(result.private, /^-----BEGIN RSA PRIVATE KEY-----/);
    assert.match(result.public, /^-----BEGIN PUBLIC KEY-----/);
    const certificate = new crypto.X509Certificate(result.cert);
    assert.strictEqual(certificate.publicKey.asymmetricKeyDetails?.modulusLength, 2048);
    assert.ok(certificate.checkPrivateKey(crypto.createPrivateKey(result.private)));
    assert.strictEqual(certificate.publicKey.export({ type: 'spki', format: 'pem' }), result.public);
    // self-signed
    assert.ok(certificate.verify(certificate.publicKey));
    assert.strictEqual(certificate.subject, 'CN=Test CN\nC=FR\nST=Savoie\nL=Chambery\nO=Test Org');
    assert.strictEqual(certificate.issuer, certificate.subject);
    assert.strictEqual(certificate.ca, false);
    assert.strictEqual(certificate.subjectAltName, `URI:urn:${os.hostname()}:OIBus, DNS:${os.hostname()}`);
    assert.deepStrictEqual(certificate.keyUsage, ['1.3.6.1.5.5.7.3.1', '1.3.6.1.5.5.7.3.2']);
    const now = DateTime.fromISO(testData.constants.dates.FAKE_NOW).set({ millisecond: 0 });
    assert.strictEqual(certificate.validFromDate.toISOString(), now.toUTC().toISO());
    assert.strictEqual(certificate.validToDate.toISOString(), now.plus({ days: 365 }).toUTC().toISO());
  });

  it('should leave the empty attributes out of the subject', async () => {
    const result = await encryptionService.generateSelfSignedCertificate({
      commonName: 'Test CN',
      countryName: 'FR',
      stateOrProvinceName: '',
      localityName: '',
      organizationName: '',
      keySize: 2048,
      daysBeforeExpiry: 365
    });

    const certificate = new crypto.X509Certificate(result.cert);
    assert.strictEqual(certificate.subject, 'CN=Test CN\nC=FR');
    assert.strictEqual(certificate.issuer, 'CN=Test CN\nC=FR');
  });
});
