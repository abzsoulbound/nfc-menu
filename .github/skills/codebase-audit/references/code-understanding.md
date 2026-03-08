# Code Understanding (Checks 1–10)

## Check 1: Codebase Exploration

**Goal**: Build a complete mental model of the project structure, entry points, and key modules.

**Procedure**:
1. List the top-level directory structure
2. Identify the framework (Next.js App Router in this project)
3. Map route groups: `(customer)`, `(public)`, `(staff)`, `api/`, `pay/`, `r/`, `waiter/`
4. Catalogue `lib/` modules by domain (auth, payments, orders, sessions, etc.)
5. Catalogue `components/` by area (admin, bar, kitchen, menu, order, etc.)
6. Note configuration files: `next.config.js`, `tsconfig.json`, `prisma/schema.prisma`

**Output**: A structured map of the codebase with entry points annotated.

---

## Check 2: Function Explanation

**Goal**: Explain what a specific function does, its inputs, outputs, side effects, and callers.

**Procedure**:
1. Read the target function fully including type signatures
2. Trace parameter usage through the function body
3. Identify side effects (DB writes, API calls, state mutations, logging)
4. Search for all call sites using grep
5. Document return type and possible error conditions

**Output**: Plain-language explanation with input/output types and call graph.

---

## Check 3: Module Dependency Analysis

**Goal**: Map import/export relationships between modules to identify coupling and circular dependencies.

**Procedure**:
1. For each file in scope, extract `import` statements
2. Build a directed graph: file → dependency
3. Detect circular imports (A → B → A)
4. Identify high fan-in modules (imported by many) — likely core utilities
5. Identify high fan-out modules (import many) — likely orchestrators
6. Flag tightly coupled module pairs

**Output**: Dependency graph with circular dependency warnings and coupling metrics.

---

## Check 4: Data Flow Tracing

**Goal**: Trace how data flows from input (API request, user action) through the system to output (DB write, API response, UI render).

**Procedure**:
1. Identify the entry point (API route handler, page component, event handler)
2. Follow the data through each transformation step
3. Note where data is validated, transformed, persisted, or displayed
4. Identify points where data could be lost, corrupted, or leaked
5. Document the complete flow as a sequence

**Output**: Step-by-step data flow trace with transformation points annotated.

---

## Check 5: Variable Usage Analysis

**Goal**: Analyse how a variable is used across its scope — assignments, reads, mutations, and potential issues.

**Procedure**:
1. Find all occurrences of the variable using grep
2. Classify each as: declaration, assignment, read, mutation, or pass-to-function
3. Check for shadowing (same name in nested scope)
4. Check for unused variables (declared but never read)
5. Check for variables read before assignment

**Output**: Variable usage report with potential issues flagged.

---

## Check 6: Call-Graph Generation

**Goal**: Generate a call graph showing which functions call which other functions.

**Procedure**:
1. Select the scope (single file, module, or cross-module)
2. Parse function definitions and their internal function calls
3. Build the call tree (caller → callee)
4. Identify leaf functions (no outgoing calls)
5. Identify root functions (no incoming calls — entry points)
6. Detect recursive or mutually recursive functions

**Output**: Call graph as a tree or Mermaid diagram.

---

## Check 7: Refactoring Suggestions

**Goal**: Identify refactoring opportunities that improve readability, maintainability, or performance.

**Procedure**:
1. Scan for functions longer than 50 lines
2. Identify deeply nested code (>3 levels)
3. Find functions with high cyclomatic complexity (many branches)
4. Detect god objects/modules that do too many things
5. Identify opportunities to extract shared logic into utilities
6. Flag inconsistent naming patterns

**Output**: Prioritised list of refactoring suggestions with before/after sketches.

---

## Check 8: Dead Code Detection

**Goal**: Find code that is never executed or referenced.

**Procedure**:
1. Find exported functions/variables and check for importers
2. Find internal functions and check for callers
3. Detect unreachable code after return/throw statements
4. Find commented-out code blocks
5. Detect unused imports
6. Check for unused CSS classes (via Tailwind purge)
7. Check for unused environment variables

**Output**: List of dead code with file locations and removal recommendations.

---

## Check 9: Duplicate Logic Detection

**Goal**: Find repeated patterns that could be consolidated.

**Procedure**:
1. Search for similar multi-line code blocks across files
2. Identify copy-pasted API handlers with minor variations
3. Detect repeated validation logic
4. Find duplicated UI patterns that could be components
5. Identify repeated error handling patterns
6. Check for near-identical utility functions

**Output**: Grouped duplicates with suggested consolidation approach.

---

## Check 10: Code Readability Analysis

**Goal**: Evaluate code readability and suggest improvements.

**Procedure**:
1. Check naming conventions (consistent camelCase/PascalCase)
2. Evaluate function/variable name clarity (descriptive vs cryptic)
3. Assess comment quality and necessity
4. Check file organisation (imports grouped, logical section ordering)
5. Evaluate type annotation completeness
6. Check for magic numbers and string literals that should be constants

**Output**: Readability score per file/module with specific improvement suggestions.
