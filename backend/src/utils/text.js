// Escapes user text so it can be used inside a Mongo $regex without changing the pattern (prevents regex injection / ReDoS).
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
module.exports = { escapeRegex }
