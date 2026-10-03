# Context Mode

Use Context Mode MCP tools to index large outputs and retrieve relevant sections. Use
`ctx_batch_execute` for multi-command research, `ctx_execute_file` for file analysis, `ctx_index`
for supplied content, and `ctx_search` for retrieval. Use native tools for reading and editing files
during code changes. Run supported CLI commands through RTK as usual.

The MCP server has no OpenCode lifecycle hooks. Execution tools run arbitrary code with the server's
OS privileges. Never use them to bypass a denied tool call, sandbox, authentication control,
plan-mode restriction, or approval requirement. Shared agent rules take precedence over routing
guidance. Updates and purges require explicit approval.
