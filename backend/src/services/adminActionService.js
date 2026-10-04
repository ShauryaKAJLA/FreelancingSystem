const AdminAction = require('../models/AdminAction')
const User = require('../models/User')
const Milestone = require('../models/Milestone')

// Audit logging NEVER throws: a failed log line must not undo or fail the admin action that already happened.
async function log(admin, actionType, actionDescription) {
  try {
    return await AdminAction.create({ adminId: admin._id, actionType, actionDescription })
  } catch (err) {
    console.error('admin action log failed:', err.message)
    return null
  }
}

// Wording copied from the frontend mock so the System Logs page reads the same.
async function logPayout(admin, payment) {
  try {
    const [milestone, freelancer] = await Promise.all([
      Milestone.findById(payment.milestoneId).select('title'),
      User.findById(payment.freelancerId).select('name'),
    ])
    return await log(admin, 'Payout Dispatched', `Dispatched ₹${payment.amount} for milestone "${milestone?.title}" (${payment.paymentId}) to ${freelancer?.name ?? 'Unknown'}.`)
  } catch (err) {
    console.error('admin action log failed:', err.message)
    return null
  }
}

module.exports = { log, logPayout }
