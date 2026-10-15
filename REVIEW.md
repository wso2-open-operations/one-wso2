# Code Review Rules

Rules for human and AI reviewers. Formatters and linters own style; review what tools can't check.

## Severity

- 🔴 Critical: a security hole, data loss, or a core flow broken. Blocks merge.
- 🟠 Major: a defect with real impact, such as a wrong result, missing error handling or tests, or a misleading
  doc. Blocks merge.
- 🟡 Minor: low impact or easy to recover from, such as an edge case or a maintainability risk. Can wait.
- ⚪ Trivial: no effect on behaviour. Optional.

## Scope

- 🟠 The change does what the issue or PR asks, and nothing more. Unrelated refactors go in a separate PR.
- 🟡 Follow existing patterns in the codebase over personal preference. Change a pattern in its own PR.

## Readability

- 🟡 Code reads top to bottom like a story. Names say what a variable holds or what a function does,
  without reading its body.
- 🟡 One responsibility per function. Prefer guard clauses over deep nesting.
- 🟡 No magic values. Use named constants or enums.
- 🟡 Don't repeat logic. Extract it once it appears more than twice.

## Documentation

- 🟡 Every public type, function, resource and field has a doc.
- 🟠 A doc covers only the item it's on: what it is or does, its parameters, return value, errors and
  side effects. No history, rationale or behaviour of other code, unless the item can't be understood
  without it.
- ⚪ Add detail beyond the name only where the name leaves meaning open, such as units or allowed values.

## Comments

- 🟡 Comment only what the code can't express. If code needs a comment to explain what it does, refactor it.
- 🟠 A needed comment (non-obvious decision, hidden invariant, ordering dependency, workaround) explains
  this code, concisely. Flag comments that are wrong or describe code elsewhere.
- ⚪ Commented-out code carries a TODO saying why it's kept. Link an issue where possible.

## Formatting

- ⚪ Use the language's standard formatter. Lines stay within 120 characters, broken where each line
  still reads clearly.

## Correctness and safety

- 🟠 Handle every error: log it with context, return the matching status, and don't leak internals to clients.
- 🔴 Validate input at the boundary. Use parameterised queries. No secrets or personal data in logs.
- 🟠 New behaviour and bug fixes come with tests.

## Pull requests

- 🟡 The PR description explains why. Keep PRs small enough to review in one pass.

## Review conduct

- Give every finding a severity. Comment on the code, not the author.
- Mark what blocks the merge separately from nitpicks.
