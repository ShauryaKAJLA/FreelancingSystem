// Real Express app (real routes, validators, JWT, bcrypt) with the User/profile models swapped for an in-memory store.
process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'e2e_secret_e2e_secret_e2e_secret_123'
const B = __dirname + '/../../backend/src'
const bcrypt = require(B + '/../node_modules/bcryptjs')
const User = require(B + '/models/User'), CP = require(B + '/models/ClientProfile'), FP = require(B + '/models/FreelancerProfile')
const db = []
const mk = (o) => ({ _id: String(db.length + 1).padStart(24, '0'), status: 'Active', createdAt: new Date(), ...o })
db.push(mk({ name: 'Meera Iyer', email: 'meera.iyer@dev.com', role: 'Freelancer', passwordHash: bcrypt.hashSync('Password@123', 4) }))
User.findOne = (q) => { const u = db.find((x) => x.email === q.email); return { select: async () => u || null } }
User.exists = async (q) => db.find((x) => x.email === q.email) || null
User.create = async (d) => { const u = mk(d); db.push(u); return u }
User.findById = async (id) => db.find((x) => x._id === id) || null
User.deleteOne = async () => {}
CP.create = FP.create = async () => ({})
require(B + '/app').listen(5055, () => console.log('stub api up'))
