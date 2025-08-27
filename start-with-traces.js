#!/usr/bin/env node

// Launcher script with detailed warning traces
process.env.NODE_OPTIONS = '--trace-warnings --trace-deprecation';

const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 Starting with detailed warning traces enabled...');
console.log('📝 Node options:', process.env.NODE_OPTIONS);

// Start both processes
const botProcess = spawn('node', ['--trace-warnings', '--trace-deprecation', 'index.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

const dashboardProcess = spawn('node', ['--trace-warnings', '--trace-deprecation', 'dashboard.js'], {
  stdio: 'inherit',
  cwd: __dirname
});

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down processes...');
  botProcess.kill();
  dashboardProcess.kill();
  process.exit(0);
});

botProcess.on('exit', (code) => {
  console.log(`🤖 Bot process exited with code ${code}`);
});

dashboardProcess.on('exit', (code) => {
  console.log(`📊 Dashboard process exited with code ${code}`);
});
