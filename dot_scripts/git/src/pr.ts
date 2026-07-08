import { createChangeRequest } from "./change-request.ts";

await createChangeRequest({
  cmd: "pr",
  abbr: "PR",
  noun: "GitHub pull request",
  nounShort: "pull request",
  hostLabel: "GitHub",
  remoteHost: "github",
  templateCandidates: [
    ".github/pull_request_template.md",
    ".github/PULL_REQUEST_TEMPLATE.md",
    "pull_request_template.md",
    "PULL_REQUEST_TEMPLATE.md",
    "docs/pull_request_template.md",
  ],
  templateDirs: [".github/PULL_REQUEST_TEMPLATE", ".github/pull_request_template"],
  create: (title, description, target) => ({
    command: "gh",
    args: ["pr", "create", "--title", title, "--body", description, "--base", target],
  }),
});
