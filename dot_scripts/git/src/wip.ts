import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  aiGenerate,
  gitOutput,
  printOutput,
  relevantDiff,
  splitTitleBody,
  stringArg,
  titleStyle,
  wrap,
} from "./utils.ts";

if (argv.h || argv.help) {
  printHelp();
  process.exit(0);
}

const branch = (await gitOutput(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
const options = parseOptions();

if ((branch === "master" || branch === "main") && options.push && !options.force) {
  console.log(
    `Cannot use push flag on ${branch}. Please run with the --force flag if you are 100% sure of what you are doing.`,
  );
  process.exit(-1);
}

printOutput(await gitOutput(["add", "--all"]));

let message = options.message;

if (options.aiMessage) {
  const diff = await relevantDiff(["--cached"]);
  const prompt = `Summarize this staged diff as a git commit message: one subject line, then a blank line, then the body.
${titleStyle("subject line", 50)}
In the body, use bullet points grouped by topic.

Do not wrap the output in a code block.

${diff}`;
  const aiOutput = await aiGenerate(prompt, { model: "openai/gpt-5.4-mini" });

  if (!aiOutput.success) {
    console.error("could not reach ai");
    if (aiOutput.details.trim()) {
      console.error(aiOutput.details);
    }
    process.exit(1);
  }

  const [subject, body] = splitTitleBody(aiOutput.text, "wip");
  const wrappedSubject = wrap(subject, 72);
  message = body
    ? `${wrappedSubject}\n\n${body
        .split(/\r?\n/)
        .map((line) => wrap(line.trimEnd(), 72))
        .join("\n")}`
    : wrappedSubject;
}

const commitArgs = ["commit", ...options.commitFlags];
let messageDirectory: string | undefined;

if (!options.noEdit) {
  messageDirectory = await mkdtemp(join(tmpdir(), "git-commit-msg-"));
  const messagePath = join(messageDirectory, "message");
  await writeFile(messagePath, message);
  commitArgs.push("-F", messagePath);
}

try {
  printOutput(await gitOutput(commitArgs));
} finally {
  if (messageDirectory) {
    await rm(messageDirectory, { recursive: true, force: true });
  }
}

if (options.push) {
  const pushArgs = ["push", "-u", "origin", branch];
  if (options.force) {
    pushArgs.push("--force-with-lease");
  }

  printOutput(await gitOutput(pushArgs));
}

function printHelp(): void {
  console.log(`Usage: git wip [options]

Quick commit all changes with a default "wip" message.
Refuses to push to master/main unless --force is given.

Options:
  -m, --message M  Commit message (default: "wip")
  -p, --push       Push after commit
  -f, --force      Force push with --force-with-lease (requires -p)
  --ai             Auto-generate commit message from staged changes
  --amend          Amend the last commit
  --no-edit        Don't edit the commit message (useful with --amend)
  --no-verify      Bypass pre-commit and commit-msg hooks
  -h, --help       Show this help`);
}

function parseOptions(): {
  push: boolean;
  force: boolean;
  message: string;
  noEdit: boolean;
  aiMessage: boolean;
  commitFlags: string[];
} {
  const message = stringArg(argv.m) ?? stringArg(argv.message) ?? "wip";
  if (argv.m === true || argv.message === true) {
    console.error("Missing commit message.");
    process.exit(1);
  }

  const commitFlags: string[] = [];
  const noVerify = argv.verify === false;
  const noEdit = argv.edit === false;

  if (noVerify) {
    commitFlags.push("--no-verify");
  }

  if (noEdit) {
    commitFlags.push("--no-edit");
  }

  if (argv.amend) {
    commitFlags.push("--amend");
  }

  return {
    push: Boolean(argv.p || argv.push),
    force: Boolean(argv.f || argv.force),
    message,
    noEdit,
    aiMessage: Boolean(argv.ai),
    commitFlags,
  };
}
