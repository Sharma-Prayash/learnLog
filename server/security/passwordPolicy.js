import { getNumberEnv } from './env.js';

export const PASSWORD_MIN_LENGTH = getNumberEnv('PASSWORD_MIN_LENGTH', 12);
const PASSWORD_MAX_BYTES = 72;

const COMMON_BREACHED_PASSWORDS = new Set([
  '000000',
  '111111',
  '112233',
  '121212',
  '123123',
  '123321',
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  '12345678910',
  '1q2w3e4r',
  '654321',
  '666666',
  '696969',
  '987654321',
  'aa123456',
  'abc123',
  'admin',
  'admin123',
  'administrator',
  'arsenal',
  'ashley',
  'babygirl',
  'baseball',
  'changeme',
  'dragon',
  'football',
  'freedom',
  'hello',
  'iloveyou',
  'letmein',
  'liverpool',
  'login',
  'lovely',
  'master',
  'monkey',
  'passw0rd',
  'password',
  'password1',
  'password123',
  'princess',
  'qwerty',
  'qwerty123',
  'qwertyuiop',
  'shadow',
  'superman',
  'test123',
  'welcome',
  'zaq12wsx',
]);

export function getPasswordPolicyHint() {
  return `Use at least ${PASSWORD_MIN_LENGTH} characters and avoid common passwords.`;
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, error: 'Password is required' };
  }

  if (!password.trim()) {
    return { valid: false, error: 'Password cannot be blank' };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    };
  }

  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return {
      valid: false,
      error: `Password must be ${PASSWORD_MAX_BYTES} bytes or fewer`,
    };
  }

  const normalized = password.trim().toLowerCase();
  if (COMMON_BREACHED_PASSWORDS.has(normalized)) {
    return {
      valid: false,
      error: 'Choose a stronger password. This password is too common or has appeared in breaches.',
    };
  }

  return { valid: true };
}
