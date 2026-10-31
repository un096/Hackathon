const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const prisma = require('../lib/prisma');
const { jwtSecret, jwtExpiresIn } = require('../config/env');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { ApiError } = require('../lib/errors');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many attempts, try again later' } });

const password = z.string().min(8, 'Password must be at least 8 characters').max(100)
  .regex(/[A-Za-z]/, 'Password must contain a letter').regex(/[0-9]/, 'Password must contain a number');

const registerSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('join'),
    joinCode: z.string().trim().min(4).max(20),
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    email: z.string().trim().toLowerCase().email(),
    password,
    designation: z.string().trim().max(100).optional(),
  }),
  z.object({
    mode: z.literal('create'),
    organizationName: z.string().trim().min(2).max(120),
    firstName: z.string().trim().min(1).max(60),
    lastName: z.string().trim().min(1).max(60),
    email: z.string().trim().toLowerCase().email(),
    password,
  }),
]);

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(100) });

function sign(user) {
  return jwt.sign({ sub: user.id, org: user.organizationId, role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn });
}
const publicUser = (u) => ({ id: u.id, email: u.email, role: u.role, firstName: u.firstName, lastName: u.lastName, organizationId: u.organizationId, employeeId: u.employee?.id || null, organizationName: u.organization?.name });

router.post('/register', limiter, validate(registerSchema), async (req, res) => {
  const b = req.body;
  if (await prisma.user.findUnique({ where: { email: b.email } })) throw new ApiError(409, 'An account with this email already exists');
  const passwordHash = await bcrypt.hash(b.password, 12);

  const user = await prisma.$transaction(async (tx) => {
    let org;
    let role = 'EMPLOYEE';
    if (b.mode === 'create') {
      org = await tx.organization.create({ data: { name: b.organizationName, joinCode: crypto.randomBytes(4).toString('hex').toUpperCase() } });
      role = 'HR';
    } else {
      org = await tx.organization.findUnique({ where: { joinCode: b.joinCode.toUpperCase() } });
      if (!org) throw new ApiError(400, 'Invalid organization join code. Ask your HR team for the code.');
    }
    const count = await tx.employee.count({ where: { organizationId: org.id } });
    const u = await tx.user.create({
      data: {
        organizationId: org.id, email: b.email, passwordHash, role, firstName: b.firstName, lastName: b.lastName,
        employee: { create: { organizationId: org.id, employeeCode: `EMP-${String(count + 1).padStart(4, '0')}-${crypto.randomBytes(2).toString('hex')}`, designation: b.designation || (role === 'HR' ? 'HR Administrator' : null) } },
      },
      include: { employee: true, organization: true },
    });
    await tx.auditLog.create({ data: { organizationId: org.id, userId: u.id, action: b.mode === 'create' ? 'ORGANIZATION_CREATED' : 'USER_REGISTERED', entityType: 'User', entityId: u.id, after: { email: u.email, role } } });
    return u;
  });

  res.status(201).json({ success: true, token: sign(user), user: publicUser(user) });
});

router.post('/login', limiter, validate(loginSchema), async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email }, include: { employee: true, organization: true } });
  // same message for unknown email and wrong password (no account enumeration)
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) throw new ApiError(401, 'Invalid email or password');
  if (!user.isActive) throw new ApiError(403, 'This account has been deactivated. Contact HR.');
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await prisma.auditLog.create({ data: { organizationId: user.organizationId, userId: user.id, action: 'LOGIN', entityType: 'User', entityId: user.id, ipAddress: req.ip } });
  res.json({ success: true, token: sign(user), user: publicUser(user) });
});

router.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, include: { employee: true, organization: true } });
  res.json({ success: true, user: publicUser(user) });
});

module.exports = router;
