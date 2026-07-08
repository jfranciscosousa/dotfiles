import { createChangeRequest } from "./change-request.ts";

await createChangeRequest({
  cmd: "mr",
  abbr: "MR",
  noun: "GitLab merge request",
  nounShort: "merge request",
  hostLabel: "GitLab",
  remoteHost: "gitlab",
  templateDirs: [".gitlab/merge_request_templates"],
  create: (title, description, target) => ({
    command: "glab",
    args: [
      "mr",
      "create",
      "--title",
      title,
      "--description",
      description,
      "--target-branch",
      target,
    ],
  }),
});
