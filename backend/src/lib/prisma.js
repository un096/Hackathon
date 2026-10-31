const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { databaseUrl } = require('../config/env');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
module.exports = prisma;
