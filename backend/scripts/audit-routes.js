#!/usr/bin/env node
// Static audit: compares the Express route table (parsed from source, no Express/Mongo needed)
// with scripts/api-contract.json (the 80 PDF endpoints + 3 frontend-only additions).
// Param names are normalised (:clientId == :id) so only method + path shape must match.
// Exit code 1 if any contract endpoint has no matching route.
const fs = require('fs')
const path = require('path')

const routesDir = path.join(__dirname, '..', 'src', 'routes')
const norm = (p) => p.replace(/:[A-Za-z0-9_]+/g, ':p').replace(/\/+$/, '') || '/'

function mounts() {
  const src = fs.readFileSync(path.join(routesDir, 'index.js'), 'utf8')
  const out = {}
  for (const m of src.matchAll(/router\.use\('([^']+)',\s*require\('\.\/([A-Za-z]+)'\)\)/g)) out[m[2]] = '/api' + m[1]
  return out
}

function parseRoutes() {
  const m = mounts()
  const routes = []
  for (const [file, prefix] of Object.entries(m)) {
    const src = fs.readFileSync(path.join(routesDir, file + '.js'), 'utf8')
    for (const r of src.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)) {
      routes.push({ method: r[1].toUpperCase(), path: prefix + (r[2] === '/' ? '' : r[2]), file })
    }
  }
  return routes
}

function audit() {
  const contract = require('./api-contract.json')
  const routes = parseRoutes()
  const have = new Map(routes.map((r) => [`${r.method} ${norm(r.path)}`, r]))
  const check = (list) => list.map((e) => {
    const [method, p] = e.split(' ')
    return { endpoint: e, found: have.get(`${method} ${norm(p)}`) || null }
  })
  const pdf = check(contract.endpoints)
  const extra = check(contract.frontendOnly)
  const known = new Set([...contract.endpoints, ...contract.frontendOnly].map((e) => { const [m, p] = e.split(' '); return `${m} ${norm(p)}` }))
  const unlisted = routes.filter((r) => !known.has(`${r.method} ${norm(r.path)}`))
  return { routes, pdf, extra, unlisted }
}

module.exports = { parseRoutes, audit, norm }

if (require.main === module) {
  const { routes, pdf, extra, unlisted } = audit()
  const miss = pdf.filter((x) => !x.found), missExtra = extra.filter((x) => !x.found)
  console.log(`Routes parsed: ${routes.length}`)
  console.log(`PDF endpoints implemented: ${pdf.length - miss.length}/${pdf.length}`)
  console.log(`Frontend-only additions implemented: ${extra.length - missExtra.length}/${extra.length}`)
  if (miss.length) { console.log('\nMISSING (PDF):'); miss.forEach((x) => console.log('  ' + x.endpoint)) }
  if (missExtra.length) { console.log('\nMISSING (frontend-only):'); missExtra.forEach((x) => console.log('  ' + x.endpoint)) }
  if (unlisted.length) { console.log('\nBackend routes not in the contract (extras):'); unlisted.forEach((r) => console.log(`  ${r.method} ${r.path}  [${r.file}]`)) }
  process.exit(miss.length || missExtra.length ? 1 : 0)
}
