const { spawn } = require('node:child_process');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];
let shuttingDown = false;

function start(name, args) {
  const child = spawn(npmCommand, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  children.push(child);

  child.on('error', (error) => {
    console.error(`Failed to start ${name}:`, error.message);
    shutdown(1);
  });

  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.log(`${name} stopped${signal ? ` (${signal})` : ` with code ${code ?? 0}`}.`);
      shutdown(code ?? 1);
    }
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  setTimeout(() => process.exit(exitCode), 100);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

start('Backend', ['run', 'dev']);
start('Frontend', ['--prefix', 'frontend', 'run', 'dev']);
