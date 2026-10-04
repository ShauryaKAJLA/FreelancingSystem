const { isString, fail, cleanText } = require('./helpers')

const validateSkill = (req, _res, next) => {
  const raw = (req.body || {}).skillName
  const name = isString(raw) ? cleanText(raw) : ''
  fail(!name ? ['skillName is required'] : name.length > 60 ? ['skillName must be 60 characters or fewer'] : [])
  req.body = { name }
  next()
}

module.exports = { validateSkill }
