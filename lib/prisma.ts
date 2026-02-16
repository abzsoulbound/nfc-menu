import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Suppress verbose logs in development; production logs set via DATABASE_URL params
    log: process.env.NODE_ENV === 'production' 
      ? [] 
      : [{ level: 'error', emit: 'stdout' }],
  })

// Always reuse single instance across all requests (critical for serverless)
// This prevents connection pool exhaustion in Vercel/serverless functions
globalForPrisma.prisma = prisma
