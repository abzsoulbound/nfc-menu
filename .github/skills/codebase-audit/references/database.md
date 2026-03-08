# Database (Checks 31–40)

## Check 31: Schema Structure Analysis

**Goal**: Evaluate the Prisma schema for correctness, completeness, and design quality.

**Procedure**:
1. Read `prisma/schema.prisma` fully
2. Map all models and their fields with types
3. Check for appropriate field types (String vs Int vs DateTime vs Enum)
4. Verify `@id`, `@unique`, `@default` annotations are correct
5. Check for missing `@updatedAt` on mutable models
6. Verify enum definitions match application usage

**Output**: Schema quality report with field-level recommendations.

---

## Check 32: Relationship Validation

**Goal**: Verify all database relationships are correctly defined and complete.

**Procedure**:
1. List all `@relation` definitions in the Prisma schema
2. Check that every foreign key has a corresponding relation field
3. Verify cascade behaviour on delete (`onDelete: Cascade` vs `SetNull` vs `Restrict`)
4. Check for orphan records risk (missing cascade or cleanup logic)
5. Verify bidirectional relations are defined on both sides
6. Check for implicit many-to-many via join tables

**Output**: Relationship map with integrity risk assessment.

---

## Check 33: Normalisation Analysis

**Goal**: Evaluate database normalisation level and identify denormalisation risks.

**Procedure**:
1. Check for repeated data across tables (e.g. item name in both MenuItem and OrderItem)
2. Identify JSON fields that might benefit from normalisation
3. Check for calculated fields stored instead of computed
4. Verify Runtime state tables are clearly marked as caches
5. Assess if denormalisation is intentional for performance
6. Check for update anomaly risks

**Output**: Normalisation assessment with recommendations.

---

## Check 34: Index Recommendation

**Goal**: Identify missing database indexes that would improve query performance.

**Procedure**:
1. Review `@@index` and `@unique` annotations in schema
2. Identify fields used in WHERE clauses across the codebase (grep for `prisma.*.findMany`, `where:`)
3. Check foreign key fields have indexes (Prisma auto-indexes `@relation` FKs)
4. Identify fields used in ORDER BY that lack indexes
5. Check for composite indexes on commonly co-queried fields
6. Verify indexes on `status`, `createdAt`, `tenantId` columns used in filters

**Output**: Missing index recommendations with expected impact.

---

## Check 35: Query Optimisation

**Goal**: Find and optimise slow or inefficient database queries.

**Procedure**:
1. Search for `prisma.*` calls across the codebase
2. Identify queries that `include` deeply nested relations
3. Find queries without `select` that fetch unnecessary fields
4. Check for queries inside loops (potential N+1)
5. Identify large `findMany` calls without `take`/`skip` limits
6. Check for raw queries that bypass Prisma's optimisations

**Output**: Query optimisation report with rewritten query suggestions.

---

## Check 36: Migration Safety Checks

**Goal**: Verify database migrations are safe and reversible.

**Procedure**:
1. Review `prisma/migrations/` for recent migrations
2. Check for destructive operations (DROP TABLE, DROP COLUMN)
3. Verify new non-nullable columns have defaults or are added in stages
4. Check for data migrations that should accompany schema changes
5. Verify migration order doesn't create temporary inconsistencies
6. Check that rollback plan exists for each migration

**Output**: Migration safety report with risk flags.

---

## Check 37: Data Integrity Validation

**Goal**: Ensure data integrity constraints are enforced at the database level.

**Procedure**:
1. Check for `@unique` constraints on business keys (not just IDs)
2. Verify `@@unique` composite constraints where needed
3. Check for CHECK constraints or application-level validation
4. Verify enum fields can't hold invalid values
5. Check that required fields are marked as non-optional in schema
6. Verify monetary amounts use appropriate types (not Float)

**Output**: Data integrity gap analysis.

---

## Check 38: Foreign Key Consistency Checks

**Goal**: Verify all foreign key relationships are correctly maintained.

**Procedure**:
1. List all foreign key fields in the schema
2. Verify cascade/restrict behaviour is appropriate for each relationship
3. Check for orphan record risk when parent is deleted
4. Verify application code doesn't bypass FK constraints
5. Check for soft-delete patterns that might leave zombie references
6. Verify Session → Cart → CartItem → Order chain integrity

**Output**: Foreign key consistency report.

---

## Check 39: Duplicate Data Detection

**Goal**: Identify data that is stored redundantly across the database.

**Procedure**:
1. Compare fields across related tables for duplication
2. Check Runtime state tables against source tables for drift risk
3. Identify JSON blobs that duplicate structured data
4. Check for denormalised counters/aggregates without sync logic
5. Verify that cached/derived data has refresh mechanisms
6. Check session data for stale copies of menu/order data

**Output**: Duplicate data map with sync risk assessment.

---

## Check 40: Transaction Safety Analysis

**Goal**: Verify that multi-step operations use transactions to prevent partial updates.

**Procedure**:
1. Search for `prisma.$transaction` usage
2. Identify multi-step operations that SHOULD be transactional (order + payment, cart + order)
3. Check for create-then-update patterns that could fail between steps
4. Verify transaction isolation levels are appropriate
5. Check for long-running transactions that could cause locks
6. Verify error handling within transactions (proper rollback)

**Output**: Transaction coverage report with missing transaction flags.
