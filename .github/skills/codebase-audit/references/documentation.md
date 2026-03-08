# Documentation (Checks 121–130)

## Check 121: API Documentation Generation

**Goal**: Generate comprehensive API documentation.

**Procedure**:
1. Enumerate all API routes with HTTP methods
2. For each route, document: URL, method, auth requirements, request schema, response schema
3. Include example request/response pairs
4. Document error responses per endpoint
5. Group endpoints by domain (menu, orders, payments, sessions)
6. Output in Markdown or OpenAPI format

**Output**: Complete API documentation file.

---

## Check 122: Architecture Documentation Generation

**Goal**: Generate system architecture documentation.

**Procedure**:
1. Map high-level system components and their interactions
2. Document the data flow between components
3. Describe the tech stack and key decisions
4. Document deployment architecture (Vercel, database hosting)
5. Include diagrams (Mermaid) for system overview
6. Document integration points (Stripe, NFC, real-time)

**Output**: Architecture documentation with diagrams.

---

## Check 123: Database Schema Documentation

**Goal**: Generate readable documentation from the Prisma schema.

**Procedure**:
1. Parse `prisma/schema.prisma` for all models
2. Document each model: fields, types, constraints, relationships
3. Generate entity-relationship diagram (Mermaid)
4. Document enums and their business meanings
5. Note indexes and their purpose
6. Document data lifecycle per model

**Output**: Database schema documentation with ER diagram.

---

## Check 124: Code Comment Generation

**Goal**: Add meaningful comments to complex or unclear code.

**Procedure**:
1. Identify functions lacking JSDoc comments that have non-obvious behaviour
2. Generate JSDoc for public API functions in `lib/`
3. Add inline comments for complex algorithmic sections
4. Document magic numbers and non-obvious constants
5. Add TODO/FIXME comments for known limitations
6. Ensure comments explain WHY, not WHAT

**Output**: Code with added comments (applied as edits).

---

## Check 125: README Generation

**Goal**: Generate or update the project README.

**Procedure**:
1. Read existing `README.md`
2. Ensure sections cover: overview, setup, development, deployment, architecture
3. Add quick-start instructions
4. Document environment variable requirements
5. Include links to detailed docs in `docs/`
6. Add badges for build status, coverage, etc.

**Output**: Updated README.md content.

---

## Check 126: Developer Onboarding Documentation

**Goal**: Create documentation to help new developers get started.

**Procedure**:
1. Document local development setup steps
2. Explain the project structure and key directories
3. Describe the development workflow (branch, develop, test, deploy)
4. List common commands (dev, build, test, lint)
5. Document coding conventions and patterns used
6. Include troubleshooting for common setup issues

**Output**: Onboarding guide document.

---

## Check 127: Feature Documentation Generation

**Goal**: Document a specific feature's implementation.

**Procedure**:
1. Identify the feature scope (files, routes, components)
2. Document the user-facing behaviour
3. Describe the technical implementation
4. Map the data flow for the feature
5. List configuration and dependencies
6. Document testing approach for the feature

**Output**: Feature documentation with code references.

---

## Check 128: Changelog Generation

**Goal**: Generate a changelog from git history.

**Procedure**:
1. Analyse recent git commits for feature/fix/refactor patterns
2. Group changes by category (Features, Fixes, Improvements, Breaking)
3. Write human-readable descriptions for each change
4. Include commit references for traceability
5. Note any breaking changes prominently
6. Follow Keep a Changelog format

**Output**: CHANGELOG.md content.

---

## Check 129: Release Note Generation

**Goal**: Generate user-facing release notes.

**Procedure**:
1. Identify user-visible changes from recent commits
2. Write non-technical descriptions of new features
3. Document fixed bugs in user-friendly language
4. Highlight important changes that affect user workflows
5. Include screenshots or examples if applicable
6. Note known issues and workarounds

**Output**: Release notes document.

---

## Check 130: Code Walkthrough Generation

**Goal**: Generate a guided walkthrough of a code area.

**Procedure**:
1. Select the code area (feature, module, flow)
2. Order files by reading sequence (entry point → implementation → helpers)
3. For each file, explain its purpose and key sections
4. Highlight important patterns and decisions
5. Note connections between files
6. Include navigation links between sections

**Output**: Step-by-step code walkthrough document.
