const Job = require('../models/Job')
const Contract = require('../models/Contract')
const User = require('../models/User')
const { escapeRegex } = require('../utils/text')
const { idOf } = require('../utils/dto')

const MAX_RESULTS = 8
const rxOf = (q) => ({ $regex: escapeRegex(q), $options: 'i' })
// Result shape the WorkspaceSearch dropdown renders: { id, label, sublabel, to }
const job = (j, sublabel, to) => ({ id: `job-${idOf(j)}`, label: j.title, sublabel, to })
const contract = (c, title, role) => ({ id: `contract-${idOf(c)}`, label: title, sublabel: `Contract · ${c.status}`, to: `/${role}/contracts/${idOf(c)}` })

// Blank query -> no results (not an error), like the mocks.
const normalize = (query) => String(query ?? '').trim().slice(0, 100)

async function forClient(client, query) {
  const q = normalize(query)
  if (!q) return []
  const jobs = await Job.find({ clientId: client._id, title: rxOf(q) }).sort({ createdAt: -1 }).limit(20).select('title status')
  const contracts = jobs.length ? await Contract.find({ clientId: client._id, jobId: { $in: jobs.map((j) => j._id) } }).limit(20).select('jobId status') : []
  const titleBy = new Map(jobs.map((j) => [idOf(j), j.title]))
  return [
    ...jobs.map((j) => job(j, `Job · ${j.status}`, `/client/jobs/${idOf(j)}`)),
    ...contracts.map((c) => contract(c, titleBy.get(idOf(c.jobId)), 'client')),
  ].slice(0, MAX_RESULTS)
}

async function forFreelancer(freelancer, query) {
  const q = normalize(query)
  if (!q) return []
  const [openJobs, myContracts] = await Promise.all([
    Job.find({ status: 'Published', title: rxOf(q) }).sort({ createdAt: -1 }).limit(20).select('title'),
    Contract.find({ freelancerId: freelancer._id }).sort({ createdAt: -1 }).limit(200).select('jobId status'),
  ])
  const contractJobs = myContracts.length ? await Job.find({ _id: { $in: myContracts.map((c) => c.jobId) }, title: rxOf(q) }).select('title') : []
  const titleBy = new Map(contractJobs.map((j) => [idOf(j), j.title]))
  return [
    ...openJobs.map((j) => job(j, 'Open job', `/freelancer/jobs/${idOf(j)}`)),
    ...myContracts.filter((c) => titleBy.has(idOf(c.jobId))).map((c) => contract(c, titleBy.get(idOf(c.jobId)), 'freelancer')),
  ].slice(0, MAX_RESULTS)
}

async function forAdmin(query) {
  const q = normalize(query)
  if (!q) return []
  const users = await User.find({ $or: [{ name: rxOf(q) }, { email: rxOf(q) }] }).sort({ name: 1 }).limit(MAX_RESULTS).select('name email role')
  return users.map((u) => ({ id: `user-${idOf(u)}`, label: u.name, sublabel: `${u.role} · ${u.email}`, to: `/admin/users/${idOf(u)}` }))
}

module.exports = { forClient, forFreelancer, forAdmin }
