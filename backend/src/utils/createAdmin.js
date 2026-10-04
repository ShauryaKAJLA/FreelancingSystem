// One-off: create (or promote nothing -- only create) an Admin account. Admins cannot self-register.
// Usage:  ADMIN_NAME="Ops Admin" ADMIN_EMAIL=ops@example.com ADMIN_PASSWORD='S0me-long-pass' npm run create-admin
// The password comes from the environment (not argv) so it does not land in shell history / process lists.

// Pure, unit-tested.
function validateAdminInput({ name, email, password }) {
  const errors = []
  if (typeof name !== 'string' || !name.trim() || name.length > 100) errors.push('ADMIN_NAME is required (max 100 characters)')
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.push('ADMIN_EMAIL must be a valid email')
  if (typeof password !== 'string' || password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) errors.push('ADMIN_PASSWORD must be 12+ characters with a letter and a number')
  return errors
}

async function main() {
  const bcrypt = require('bcryptjs')
  const mongoose = require('mongoose')
  const connectDB = require('../config/db')
  const User = require('../models/User')
  const input = { name: process.env.ADMIN_NAME, email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }
  const errors = validateAdminInput(input)
  if (errors.length) throw new Error(errors.join('; '))

  await connectDB()
  const email = input.email.trim().toLowerCase()
  if (await User.exists({ email })) throw new Error(`A user with ${email} already exists (nothing changed).`)
  const passwordHash = await bcrypt.hash(input.password, 12)
  const admin = await User.create({ name: input.name.trim(), email, passwordHash, role: 'Admin' })
  console.log(`Admin created: ${admin.email} (${admin._id})`)
  await mongoose.disconnect()
}

module.exports = { validateAdminInput }

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
