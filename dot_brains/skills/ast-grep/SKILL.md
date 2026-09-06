---
name: ast-grep
description:
  Search source code by syntax structure with ast-grep. Use for language constructs, call patterns,
  or relationships such as a call inside a method. Use text search for prose, logs, and filenames.
---

# Structural code search

## Workflow

1. Identify the language, relevant paths, and what must match or not match. Inspect nearby code to
   resolve ordinary uncertainty; ask only when the intended semantics remain unclear.
2. Confirm that `ast-grep` is installed. An `sg` binary is usable only if its version output
   identifies ast-grep. If neither is available, report the limitation and use scoped text search.
   Do not install tools without permission.
3. Start with a simple pattern and the smallest relevant directory. Add YAML rules only when the
   query needs structural relationships or combinations.
4. For a nontrivial rule, test at least one positive and one negative example before widening the
   search. Include nested functions or classes when ownership matters. Prefer stdin; use an approved
   temporary directory if files are necessary.
5. Inspect matching source before drawing conclusions. Report paths, rule scope, and limitations. An
   AST match is not proof of runtime behavior or complete error handling.

This is a search skill. Do not run rewrite, update-all, or fix commands unless the user requests
code changes. Do not search ignored dependency or generated trees without a task-specific reason.

## Simple patterns

Use single quotes so the shell does not expand metavariables. `$ARG` matches one node; `$$$ARGS`
matches a sequence.

```bash
ast-grep run --pattern 'console.log($$$ARGS)' --lang javascript src/
ast-grep run --pattern 'function $NAME($$$ARGS) { $$$BODY }' --lang javascript src/
```

Use `--json` when structured output is needed. Check local `--help` for version-specific options.

## Relational rules

`has` searches descendants; `inside` searches ancestors. Their default `stopBy: neighbor` checks
only the immediate relation. Use `stopBy: end` only when traversal to the end is intended. Use a
custom stopping rule when the search must not cross a function, class, or other ownership boundary.
Do not add `stopBy: end` indiscriminately: nested constructs can produce false positives.

Example: find function declarations with an `await` somewhere in their subtree. This includes nested
functions; it does not prove the outer function itself awaits or has the `async` modifier.

```bash
printf '%s\n' 'async function example() { await fetchData(); }' |
  ast-grep scan --inline-rules '
id: function-with-await-subtree
language: javascript
rule:
  kind: function_declaration
  has:
    pattern: await $EXPR
    stopBy: end
' --stdin
```

For a rule file:

```bash
ast-grep scan --rule /path/to/rule.yml src/
```

Use `all`, `any`, and `not` to combine constraints. A rule for "no try-catch in this subtree" cannot
establish that an operation lacks error handling elsewhere.

## Debugging

```bash
ast-grep run --pattern 'class User { constructor() {} }' \
  --lang javascript --debug-query=cst
```

When a rule fails, check the language, parsed node kinds, metavariable quoting, and traversal
boundaries. Reduce it to the smallest failing example rather than repeatedly searching the whole
repository. Confirm a no-match result is not a syntax or tool failure.

## References

Consult these official references when the local help and examples are insufficient:

- [Rule object reference](https://ast-grep.github.io/reference/rule): rule fields and syntax.
- [Relational rules](https://ast-grep.github.io/guide/rule-config/relational-rule): traversal and
  stopping boundaries.
- [Debugging rules](https://ast-grep.github.io/blog/how-to-debug): diagnosing unexpected matches.
