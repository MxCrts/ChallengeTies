// eas-hooks/eas-build-pre-install.js
const { execSync } = require('child_process');

module.exports = async function preInstallHook() {
  console.log('🔵 Running npm install --legacy-peer-deps before EAS build...');
  execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
};
