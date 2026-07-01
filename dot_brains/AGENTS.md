# Personal rules

These are my personal styles. They bypass anything specific on project-level guidelines.

### ast-grep

Avoid grep and use faster and better ast-grep (if you can)

### Typechecks and builds

On very large projects, do not run type checks, lints, or compiles. 

Only do this if there's a way to lint, verify, or equivalent for specific files and not the whole project.

### Git

Never perform git, gitlab or github operations unless I specifically specify it.

And if you do, any branch you create should be prefixed with fs/

### Terminal file links

When referencing files in terminal-facing responses, format them for editor
cmd-click detection: prefer short repo-relative `path:line` references, put
important file references on their own line when possible, and avoid tree
decorations or long prose around the path that can wrap in narrow terminals.

### MCP resource links

Whenever you use MCPs to create, read, update or delete anything, 
please provide an HTTP link to that resource when applicable.
