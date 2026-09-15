const { spawn, execSync } = require('child_process');
const http = require('http');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4200';
const testArgs = process.argv.slice(2);

if (testArgs.length === 0) {
  console.error('Uso: node scripts/run-e2e-with-server.js <comando> [args...]');
  process.exit(1);
}

function requestOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(!!res.statusCode && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(url, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await requestOk(url)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`El servidor no respondió en ${url}`);
}

function killProcessTree(child) {
  if (!child || child.killed) {
    return;
  }
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  } catch {
    /* el proceso ya pudo haber terminado */
  }
}

async function main() {
  const alreadyUp = await requestOk(BASE_URL);
  let server = null;

  if (!alreadyUp) {
    server = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'start'], {
      stdio: 'inherit',
      shell: true,
    });
  }

  const shutdown = (code) => {
    if (server) {
      killProcessTree(server);
    }
    process.exit(code ?? 0);
  };

  process.on('SIGINT', () => shutdown(1));
  process.on('SIGTERM', () => shutdown(1));

  try {
    await waitForServer(BASE_URL);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    shutdown(1);
    return;
  }

  const tests = spawn(testArgs.join(' '), {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  tests.on('exit', (code) => shutdown(code ?? 1));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
