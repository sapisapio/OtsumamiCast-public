const fs = require('fs');
const path = require('path');

function validPort(value) {
  return /^\d+$/.test(String(value)) && Number(value) >= 1 && Number(value) <= 65535;
}

function readSettings(directory) {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(directory, 'app-settings.json'), 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

function writeSettings(directory, patch) {
  const settings = { ...readSettings(directory), ...patch };
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, 'app-settings.json');
  fs.writeFileSync(`${target}.tmp`, JSON.stringify(settings, null, 2));
  fs.renameSync(`${target}.tmp`, target);
  return settings;
}

function getPort() {
  return validPort(process.env.PORT) ? Number(process.env.PORT) : 7244;
}

function getLocalOrigin() { return `http://localhost:${getPort()}`; }

module.exports = { validPort, readSettings, writeSettings, getPort, getLocalOrigin };
