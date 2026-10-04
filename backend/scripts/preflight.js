// Pre-deploy gate. Run with the PRODUCTION environment loaded:  NODE_ENV=production npm run preflight
// 1) validates env exactly like the server does, 2) connects to MongoDB, 3) checks required indexes and that an Admin exists,
// 4) prints reminders for the things a script cannot check (webhook registration, backups). Exit code 1 on any failure.
require('dotenv').config()
const env = require('../src/config/env')

const fail = []; const warn = []
const line = (ok, msg) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)

async function main() {
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  const problems = env.findEnvProblems({ ...env, nodeEnv: 'production' })
  process.env.NODE_ENV = prev
  line(!problems.length, 'production env validation' + (problems.length ? `:\n   - ${problems.join('\n   - ')}` : ''))
  if (problems.length) fail.push('env')
  if (/rzp_test_/.test(env.razorpayKeyId)) warn.push('RAZORPAY_KEY_ID is a TEST key (fine for staging, not for real money)')
  if (env.clientUrl.split(',').some((u) => /^http:\/\//.test(u.trim()) && !/localhost|127\.0\.0\.1/.test(u))) warn.push('CLIENT_URL contains a non-https origin')

  const mongoose = require('mongoose')
  try {
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 })
    line(true, 'MongoDB connection')
  } catch (e) { line(false, `MongoDB connection: ${e.message}`); fail.push('db'); return finish() }

  const must = { // collection -> index key signatures that must exist (built by Mongoose autoIndex or `syncIndexes`)
    bids: ['jobId_1_freelancerId_1', 'freelancerId_1_bidDate_-1', 'jobId_1_status_1'],
    payments: ['providerOrderId_1', 'fundedLock_1', 'providerPaymentId_1', 'clientId_1_paidAt_-1_createdAt_-1', 'freelancerId_1_paidAt_-1_createdAt_-1'],
    contracts: ['jobId_1_freelancerId_1', 'clientId_1_createdAt_-1'],
    users: ['email_1'],
  }
  for (const [coll, names] of Object.entries(must)) {
    let have = []
    try { have = (await mongoose.connection.db.collection(coll).indexes()).map((i) => i.name) } catch { /* collection missing */ }
    const missing = names.filter((n) => !have.includes(n))
    line(!missing.length, `indexes on ${coll}${missing.length ? ` — missing: ${missing.join(', ')} (start the API once, or run syncIndexes)` : ''}`)
    if (missing.length) fail.push(`idx:${coll}`)
  }
  const admins = await mongoose.connection.db.collection('users').countDocuments({ role: 'Admin' })
  line(admins > 0, `at least one Admin exists${admins ? '' : ' — run `npm run create-admin`'}`)
  if (!admins) fail.push('admin')
  await mongoose.disconnect()
  finish()
}
function finish() {
  warn.forEach((w) => console.log(`WARN  ${w}`))
  console.log('\nNot checkable here — confirm manually (docs/DEPLOY.md): Razorpay webhook registered with the same secret and events; a backup exists and a restore has been rehearsed; HTTPS terminates in front of both web and API.')
  process.exit(fail.length ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
