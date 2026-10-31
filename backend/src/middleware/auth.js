const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { jwtSecret } = require('../config/env');
const { ApiError } = require('../lib/errors');

/** Verifies the JWT and re-loads the user from the DB (role / active flag are never trusted from the token alone). */
async function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Authentication required');
  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    throw new ApiError(401, 'Session expired or invalid token');
  }
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, organizationId: true, isActive: true, employee: { select: { id: true } } },
  });
  if (!user || !user.isActive) throw new ApiError(401, 'Account is inactive or no longer exists');
  req.user = { ...user, employeeId: user.employee?.id || null };
  next();
}

/** Backend RBAC — the only authoritative role check. */
const authorize = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) throw new ApiError(403, `This action requires role: ${roles.join(' or ')}`);
  next();
};

module.exports = { authenticate, authorize };
