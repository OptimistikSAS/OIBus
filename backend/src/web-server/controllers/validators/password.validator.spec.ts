import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import JoiValidator from './joi.validator';
import { changePasswordSchema, userPasswordSchema } from './oibus-validation-schema';

describe('Password validators', () => {
  const validator = new JoiValidator();

  describe('user password', () => {
    it('should accept a password from 8 to 128 characters, of any composition', async () => {
      await assert.doesNotReject(validator.validate(userPasswordSchema, { password: 'abcdefgh' }));
      await assert.doesNotReject(validator.validate(userPasswordSchema, { password: 'é'.repeat(128) }));
    });

    it('should reject a missing password', async () => {
      await assert.rejects(validator.validate(userPasswordSchema, {}), { message: '"password" is required' });
    });

    it('should reject a password shorter than 8 characters', async () => {
      await assert.rejects(validator.validate(userPasswordSchema, { password: 'abcdefg' }), {
        message: '"password" length must be at least 8 characters long'
      });
    });

    it('should reject a password longer than 128 characters', async () => {
      await assert.rejects(validator.validate(userPasswordSchema, { password: 'a'.repeat(129) }), {
        message: '"password" length must be less than or equal to 128 characters long'
      });
    });
  });

  describe('password change', () => {
    it('should accept a current password and a valid new one', async () => {
      await assert.doesNotReject(validator.validate(changePasswordSchema, { currentPassword: 'pass', newPassword: 'abcdefgh' }));
    });

    it('should reject a missing current password and a too short new one', async () => {
      await assert.rejects(validator.validate(changePasswordSchema, { currentPassword: '', newPassword: 'short' }), {
        message: '"currentPassword" is not allowed to be empty. "newPassword" length must be at least 8 characters long'
      });
    });

    it('should reject a new password longer than 128 characters', async () => {
      await assert.rejects(validator.validate(changePasswordSchema, { currentPassword: 'pass', newPassword: 'a'.repeat(129) }), {
        message: '"newPassword" length must be less than or equal to 128 characters long'
      });
    });
  });
});
