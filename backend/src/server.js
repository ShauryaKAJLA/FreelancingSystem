const env = require('./config/env')
env.validateEnv() // production: fail fast on missing/weak configuration
const mongoose = require('mongoose')
const connectDB = require('./config/db')
const app = require('./app')

let server
let shuttingDown = false

// Graceful shutdown: stop accepting connections, let in-flight requests finish (bounded), close Mongo, exit.
async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`${signal} received: draining connections`)
  const force = setTimeout(() => {
    console.error('Shutdown timed out; forcing exit')
    process.exit(1)
  }, env.shutdownTimeoutMs)
  force.unref()
  try {
    if (server) await new Promise((resolve) => server.close(resolve))
    await mongoose.connection.close()
    console.log('Clean shutdown')
    process.exit(0)
  } catch (err) {
    console.error('Error during shutdown:', err.message)
    process.exit(1)
  }
}

async function start() {
  await connectDB()
  server = app.listen(env.port, () => console.log(`FreelanceFlow API listening on port ${env.port} (${env.nodeEnv})`))
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err)
  process.exit(1)
})

start().catch((err) => {
  console.error('Failed to start server:', err.message)
  process.exit(1)
})
