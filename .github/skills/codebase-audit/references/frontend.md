# Frontend (Checks 71–80)

## Check 71: Component Hierarchy Analysis

**Goal**: Map and evaluate the React component tree for clarity and depth.

**Procedure**:
1. Start from layout.tsx and trace route-level page components
2. Map component nesting for key user flows (menu browsing, ordering, checkout)
3. Identify deeply nested components (>5 levels) that may need flattening
4. Check for wrapper components that add no value
5. Verify component co-location with their routes
6. Assess reuse patterns — shared vs route-specific components

**Output**: Component tree diagram with depth and reuse metrics.

---

## Check 72: State Management Analysis

**Goal**: Evaluate state management patterns for correctness and simplicity.

**Procedure**:
1. Identify all Zustand stores and their shapes
2. Map which components use which stores
3. Check for state that should be server state (fetched, not client-stored)
4. Identify prop drilling that could use context or stores
5. Check for redundant state (derived values stored instead of computed)
6. Verify state cleanup on unmount/navigation

**Output**: State management map with improvement suggestions.

---

## Check 73: Unnecessary Re-render Detection

**Goal**: Find components that re-render more often than needed.

**Procedure**:
1. Check for components without `React.memo` that receive stable props
2. Find inline object/array/function creation in JSX props
3. Look for context consumers that re-render on unrelated context changes
4. Check Zustand selectors for over-subscription (selecting too much state)
5. Identify parent components whose state changes force child re-renders
6. Check for `key` prop misuse causing unnecessary unmount/remount

**Output**: Re-render risk analysis with fix suggestions.

---

## Check 74: Component Reusability Suggestions

**Goal**: Identify opportunities to create reusable components.

**Procedure**:
1. Find similar UI patterns repeated across different pages
2. Identify components with hardcoded content that could accept props
3. Check for layout patterns used in multiple places
4. Look for form field patterns that could be a shared component
5. Identify card/list/table patterns with minor variations
6. Check `components/ui/` for missing common components

**Output**: Reusability opportunities with abstraction suggestions.

---

## Check 75: CSS Redundancy Detection

**Goal**: Find duplicate or conflicting CSS/Tailwind styles.

**Procedure**:
1. Search for repeated Tailwind class combinations across components
2. Check for conflicting classes on the same element
3. Identify custom CSS in `globals.css` that duplicates Tailwind utilities
4. Look for inline styles that could use Tailwind classes
5. Check for unused custom CSS classes
6. Verify Tailwind config for unused theme extensions

**Output**: CSS redundancy report with consolidation suggestions.

---

## Check 76: Layout Consistency Analysis

**Goal**: Verify visual layout consistency across the application.

**Procedure**:
1. Check spacing values for consistency (using Tailwind's scale)
2. Verify consistent container widths, max-widths, and padding
3. Check header/footer consistency across routes
4. Verify consistent card/panel styling
5. Check font size usage for visual hierarchy consistency
6. Verify consistent border radius, shadow, and colour usage

**Output**: Layout consistency report with standardisation recommendations.

---

## Check 77: Accessibility Checks

**Goal**: Verify the application meets WCAG accessibility standards.

**Procedure**:
1. Check for missing `alt` attributes on images
2. Verify form inputs have associated labels
3. Check for sufficient colour contrast ratios
4. Verify keyboard navigation works (tab order, focus indicators)
5. Check for ARIA roles and attributes on interactive elements
6. Verify screen reader compatibility (semantic HTML, heading hierarchy)

**Output**: Accessibility audit with WCAG violation list.

---

## Check 78: Responsive Design Analysis

**Goal**: Verify the UI works correctly across screen sizes.

**Procedure**:
1. Check for Tailwind responsive breakpoint usage (`sm:`, `md:`, `lg:`)
2. Identify fixed-width elements that might overflow on mobile
3. Check for `overflow-hidden` or `overflow-x-auto` where needed
4. Verify touch-friendly spacing on mobile layouts
5. Check that modals/dialogs work on small screens
6. Verify images and media are responsively sized

**Output**: Responsive design audit per key page.

---

## Check 79: Mobile Tap-Target Validation

**Goal**: Ensure all interactive elements are easily tappable on mobile.

**Procedure**:
1. Check button/link minimum sizes (48x48px recommended)
2. Verify adequate spacing between adjacent tap targets
3. Check that form inputs are tall enough on mobile
4. Verify dropdown/select elements are touch-friendly
5. Check that close/dismiss buttons are accessible on mobile
6. Verify menu navigation items have adequate tap areas

**Output**: Tap-target compliance report per page.

---

## Check 80: Form Validation Coverage

**Goal**: Verify all forms validate user input properly.

**Procedure**:
1. List all forms in the application
2. Check each form for client-side validation
3. Verify validation messages are clear and helpful
4. Check for real-time validation (as-you-type) vs submit-time only
5. Verify server-side validation matches client-side rules
6. Check for missing validation: required fields, email format, phone, amounts

**Output**: Form validation coverage matrix.
