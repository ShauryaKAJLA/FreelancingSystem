const mongoose = require('mongoose')
const env = require('./env')

mongoose.set('strictQuery', true)

async function connectDB() {
  await mongoose.connect(env.mongoUri)
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`)
}

module.exports = connectDB
