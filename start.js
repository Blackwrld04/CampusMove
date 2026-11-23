const { spawn } = require('child_process');
const path = require('path');

const rootDir = __dirname;
const serverDir = path.join(rootDir, 'server');
const clientDir = path.join(rootDir, 'client');

console.log('🚀 Starting CampusMove (OAU Edition)...');

// Start Express Backend
const server = spawn('node', ['src/index.js'], {
  cwd: serverDir,
  stdio: 'inherit',
  env: { ...process.env, PORT: '3001' }
});

// Start Vite Client
const client = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '5173'], {
  cwd: clientDir,
  stdio: 'inherit'
});

process.on('SIGINT', () => {
  server.kill();
  client.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.kill();
  client.kill();
  process.exit(0);
});

