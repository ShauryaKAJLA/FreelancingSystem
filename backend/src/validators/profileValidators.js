const ApiError = require('../utils/ApiError')
const { isString, isObjectId } = require('./helpers')

const fail = (errors) => {
  if (errors.length) throw new ApiError(400, 'Validation failed', errors)
}

// Whitelist fields: anything else (rating, userId, _id...) is dropped so it can't be mass-assigned.
const validateFreelancerProfile = (req, _res, next) => {
  const b = req.body || {}
  const out = {}
  const errors = []

  if (b.bio !== undefined) {
    if (!isString(b.bio) || b.bio.length > 2000) errors.push('bio must be a string up to 2000 characters')
    else out.bio = b.bio.trim()
  }
  if (b.hourlyRate !== undefined) {
    const n = Number(b.hourlyRate)
    if (typeof b.hourlyRate === 'boolean' || b.hourlyRate === '' || !Number.isFinite(n) || n <= 0 || n > 100000) errors.push('Enter a valid hourly rate.')
    else out.hourlyRate = n
  }
  if (b.skillIds !== undefined) {
    if (!Array.isArray(b.skillIds) || b.skillIds.length > 50 || !b.skillIds.every(isObjectId)) errors.push('skillIds must be an array (max 50) of valid skill ids')
    else out.skillIds = [...new Set(b.skillIds)]
  }
  if (!errors.length && Object.keys(out).length === 0) errors.push('provide at least one of: bio, hourlyRate, skillIds')

  fail(errors)
  req.body = out
  next()
}

const validateClientProfile = (req, _res, next) => {
  const b = req.body || {}
  const out = {}
  const errors = []

  if (b.name !== undefined) {
    if (!isString(b.name) || !b.name.trim()) errors.push('Name is required.')
    else if (b.name.length > 100) errors.push('name must be 100 characters or fewer')
    else out.name = b.name.trim()
  }
  if (b.companyName !== undefined) {
    if (!isString(b.companyName) || b.companyName.length > 120) errors.push('companyName must be a string up to 120 characters')
    else out.companyName = b.companyName.trim()
  }
  if (b.website !== undefined) {
    if (!isString(b.website) || b.website.length > 200) errors.push('website must be a string up to 200 characters')
    else if (/^\s*(javascript|data|vbscript):/i.test(b.website)) errors.push('website must be a plain web address')
    else out.website = b.website.trim()
  }
  if (!errors.length && Object.keys(out).length === 0) errors.push('provide at least one of: name, companyName, website')

  fail(errors)
  req.body = out
  next()
}

// PUT /freelancers/:id/extras  { paymentAccount?, pastProjects? }  (each replaces the stored value)
const validateFreelancerExtras = (req, _res, next) => {
  const b = req.body || {}
  const out = {}
  const errors = []
  const txt = (v, max) => (isString(v) ? v.trim().slice(0, max) : '')

  if (b.paymentAccount !== undefined) {
    const a = b.paymentAccount
    if (a === null || typeof a !== 'object' || Array.isArray(a)) errors.push('paymentAccount must be an object')
    else {
      const acct = {
        holderName: txt(a.holderName, 100), bankName: txt(a.bankName, 100), accountNumber: txt(a.accountNumber, 34),
        ifsc: txt(a.ifsc, 11).toUpperCase(), upiId: txt(a.upiId, 100),
      }
      const hasBank = acct.accountNumber && acct.ifsc && acct.holderName
      if (!hasBank && !acct.upiId) errors.push('Enter bank details (holder, account number, IFSC) or a UPI ID.')
      else if (acct.accountNumber && !/^\d{6,34}$/.test(acct.accountNumber)) errors.push('Account number must be 6-34 digits.')
      else if (acct.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(acct.ifsc)) errors.push('Enter a valid IFSC code.')
      else if (acct.upiId && !/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/.test(acct.upiId)) errors.push('Enter a valid UPI ID.')
      else out.paymentAccount = acct
    }
  }
  if (b.pastProjects !== undefined) {
    if (!Array.isArray(b.pastProjects) || b.pastProjects.length > 20) errors.push('pastProjects must be an array (max 20)')
    else {
      const list = []
      for (const p of b.pastProjects) {
        const title = p && typeof p === 'object' ? txt(p.title, 150) : ''
        if (!title) { errors.push('Enter a project title.'); break }
        const link = txt(p.link, 300)
        if (link && /^\s*(javascript|data|vbscript):/i.test(link)) { errors.push('Project link must be a plain web address'); break }
        list.push({ title, description: txt(p.description, 1000), year: txt(p.year, 10), link })
      }
      if (!errors.length) out.pastProjects = list
    }
  }
  if (!errors.length && Object.keys(out).length === 0) errors.push('provide at least one of: paymentAccount, pastProjects')
  fail(errors)
  req.body = out
  next()
}

module.exports = { validateFreelancerProfile, validateClientProfile, validateFreelancerExtras }
