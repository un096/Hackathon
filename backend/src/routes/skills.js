const router = require('express').Router();
const prisma = require('../lib/prisma');

router.get('/', async (_req, res) => {
  const skills = await prisma.skill.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }], select: { id: true, name: true, slug: true, category: true, description: true } });
  res.json({ success: true, data: skills });
});
module.exports = router;
