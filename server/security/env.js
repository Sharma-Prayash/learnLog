export function getBooleanEnv(name, defaultValue = false) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

export function getNumberEnv(name, defaultValue) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : defaultValue;
}

export function isProductionEnv() {
  return process.env.NODE_ENV === 'production';
}
