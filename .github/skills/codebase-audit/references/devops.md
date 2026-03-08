# DevOps (Checks 111–120)

## Check 111: CI Pipeline Validation

**Goal**: Verify CI pipeline configuration is correct and comprehensive.

**Procedure**:
1. Read `.github/workflows/` for CI configuration (e.g. `quality-gates.yml`)
2. Check that lint, type-check, test, and build steps are all present
3. Verify pipeline runs on PR and push to main
4. Check for parallelisation of independent steps
5. Verify failure notifications are configured
6. Check that CI uses the same Node.js version as production

**Output**: CI pipeline audit with missing steps.

---

## Check 112: Deployment Configuration Analysis

**Goal**: Verify production deployment is correctly configured.

**Procedure**:
1. Check `next.config.js` for production settings
2. Verify Vercel configuration is appropriate
3. Check for environment-specific configuration handling
4. Verify build output is optimised (compression, minification)
5. Check for deployment scripts or Vercel project settings
6. Verify zero-downtime deployment support

**Output**: Deployment configuration health report.

---

## Check 113: Environment Configuration Validation

**Goal**: Ensure all environments (dev, staging, prod) are correctly configured.

**Procedure**:
1. List all environment variables referenced in code
2. Check `VERCEL_PRODUCTION_ENV_TEMPLATE.md` against actual needs
3. Verify dev, staging, and production have appropriate values
4. Check for environment-specific feature flags
5. Verify database connection strings are per-environment
6. Check that Stripe keys match the environment (test vs live)

**Output**: Environment configuration matrix with gaps.

---

## Check 114: Build Optimisation Analysis

**Goal**: Optimise build time and output size.

**Procedure**:
1. Check `next.config.js` for build optimisations
2. Verify `esbuild-smoke.js` and custom build scripts
3. Check for unnecessary transpilation or polyfills
4. Verify image optimisation configuration
5. Check for build-time data fetching that slows builds
6. Verify incremental builds work correctly

**Output**: Build optimisation recommendations.

---

## Check 115: Container Configuration Analysis

**Goal**: Evaluate containerisation setup if applicable.

**Procedure**:
1. Check for Dockerfile or docker-compose configuration
2. Verify base image is appropriate and up-to-date
3. Check for multi-stage builds to reduce image size
4. Verify that `.dockerignore` excludes unnecessary files
5. Check for health check configuration
6. Verify environment variable injection at runtime

**Output**: Container configuration assessment or skip note if not containerised.

---

## Check 116: Infrastructure Dependency Validation

**Goal**: Verify all infrastructure dependencies are documented and healthy.

**Procedure**:
1. List all external services: PostgreSQL, Stripe, Vercel, DNS
2. Check for health check endpoints for each dependency
3. Verify fallback behaviour when dependencies are unavailable
4. Check for infrastructure-as-code (Terraform, Pulumi) or manual setup
5. Verify backup and recovery procedures per dependency
6. Check `DB_OUTAGE_RUNBOOK.md` for database failure handling

**Output**: Infrastructure dependency map with health status.

---

## Check 117: Log Coverage Analysis

**Goal**: Verify logging is adequate for debugging and monitoring.

**Procedure**:
1. Review `lib/logger.ts` for logging patterns
2. Check for log coverage on error paths
3. Verify structured logging format (JSON, consistent fields)
4. Check that sensitive data is not logged
5. Identify blind spots (code paths with no logging)
6. Verify log levels are used correctly (error, warn, info, debug)

**Output**: Log coverage map with blind spots.

---

## Check 118: Monitoring Recommendations

**Goal**: Recommend monitoring setup for production.

**Procedure**:
1. Check for existing monitoring (Vercel Analytics, error tracking)
2. Recommend key metrics: response time, error rate, throughput
3. Identify critical paths that need dedicated monitoring
4. Recommend alerting thresholds per metric
5. Check for real-user monitoring (RUM) setup
6. Recommend uptime monitoring configuration

**Output**: Monitoring recommendation document.

---

## Check 119: Alert Configuration Analysis

**Goal**: Verify alerting is configured for production incidents.

**Procedure**:
1. Check for alert configuration in CI/CD or monitoring tools
2. Verify alerts exist for: downtime, high error rate, payment failures
3. Check alert routing (who gets notified)
4. Verify alert escalation procedures
5. Check `INCIDENT_RESPONSE_RUNBOOK.md` for alert handling
6. Recommend missing alerts

**Output**: Alert configuration audit.

---

## Check 120: Backup Strategy Validation

**Goal**: Verify data backup and recovery procedures.

**Procedure**:
1. Check for automated database backup configuration
2. Verify backup frequency and retention policy
3. Check for backup testing/restore procedures
4. Verify point-in-time recovery capability
5. Check for application data backup (uploaded files, configs)
6. Verify `ROLLBACK_RUNBOOK.md` covers data recovery

**Output**: Backup strategy assessment with gap analysis.
