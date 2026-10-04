// Creates backend/.env from .env.example (with a random JWT secret) if missing. Frontend already ships a .env.
const fs = require('fs'), path = require('path'), crypto = require('crypto')
const dst = path.join(__dirname, '..', 'backend', '.env')
if (fs.existsSync(dst)) return console.log('backend/.env exists, left unchanged')
const src = fs.readFileSync(path.join(__dirname, '..', 'backend', '.env.example'), 'utf8')
fs.writeFileSync(dst, src.replace('JWT_SECRET=change_this_secret', 'JWT_SECRET=' + crypto.randomBytes(48).toString('hex')))
console.log('Created backend/.env  (set MONGODB_URI and Razorpay keys if needed)')
