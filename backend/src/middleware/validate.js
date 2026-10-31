const { ApiError } = require('../lib/errors');

/** Validate req.body / req.query with a Zod schema; replaces the value with the parsed (sanitised) data. */
const validate = (schema, where = 'body') => (req, _res, next) => {
  const r = schema.safeParse(req[where]);
  if (!r.success) {
    throw new ApiError(400, 'Validation failed', r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  if (where === 'query') req.validQuery = r.data;
  else req[where] = r.data;
  next();
};
module.exports = { validate };
