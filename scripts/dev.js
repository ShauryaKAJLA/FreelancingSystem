// Runs API (:5000) and web (:5173) together, prefixing output. Ctrl+C stops both.
const { spawn } = require('child_process')
const run = (name, args) => {
  const p = spawn('npm', ['--prefix', name === 'api' ? 'backend' : 'frontend', ...args], { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' })
  const pipe = (s) => s.on('data', d => String(d).split('\n').filter(Boolean).forEach(l => console.log(`[${name}] ${l}`)))
  pipe(p.stdout); pipe(p.stderr)
  p.on('exit', c => { console.log(`[${name}] exited ${c}`); process.exit(c || 0) })
  return p
}
const ps = [run('api', ['run', 'dev']), run('web', ['run', 'dev'])]
process.on('SIGINT', () => { ps.forEach(p => p.kill()); process.exit(0) })
