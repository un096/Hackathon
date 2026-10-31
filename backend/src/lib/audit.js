const prisma = require('./prisma');

/** Write an audit record. Never throws (auditing must not break the request). */
async function audit(req, action, entityType, entityId, before, after, tx = prisma) {
  try {
    await tx.auditLog.create({
      data: {
        organizationId: req.user.organizationId,
        userId: req.user.id,
        action,
        entityType,
        entityId: entityId || null,
        before: before ?? undefined,
        after: after ?? undefined,
        ipAddress: req.ip,
      },
    });
  } catch (e) {
    console.warn('[audit] failed to write', action, e.message);
  }
}
module.exports = { audit };
