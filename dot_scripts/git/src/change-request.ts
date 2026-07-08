import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  aiGenerate,
  detectDefaultBranch,
  gitOutput,
  maybeGitOutput,
  relevantDiff,
  repoRoot,
  runCommand,
  splitTitleBody,
  stringArg,
  titleStyle,
} from "./utils.ts";

export type ChangeRequestConfig = {
  cmd: string;
  abbr: string;
  noun: string;
  nounShort: string;
  hostLabel: string;
  remoteHost: string;
  templateCandidates?: string[];
  templateDirs?: string[];
  create: (
    title: string,
    description: string,
    target: string,
  ) => { command: string; args: string[] };
};

type Template = {
  content: string;
  path: string;
};

export async function createChangeRequest(config: ChangeRequestConfig): Promise<void> {
  if (argv.h || argv.help) {
    printHelp(config);
    return;
  }

  let target = stringArg(argv.t) ?? stringArg(argv.target);
  if ((argv.t === true || argv.target === true) && !target) {
    console.error("Missing target branch.");
    process.exit(1);
  }

  const remoteUrl = (await maybeGitOutput(["remote", "get-url", "origin"])).trim();
  if (!remoteUrl.includes(config.remoteHost)) {
    console.error(`Remote origin does not point to ${config.hostLabel}: ${remoteUrl}`);
    process.exit(1);
  }

  const branch = (await gitOutput(["rev-parse", "--abbrev-ref", "HEAD"])).trim();
  target ??= await detectDefaultBranch();

  if (branch === target) {
    console.error(`Already on ${target}, nothing to merge.`);
    process.exit(1);
  }

  await gitOutput(["fetch", "origin", target]);

  const log = await gitOutput(["log", `origin/${target}..HEAD`, "--oneline"]);
  const diffRange = `origin/${target}...HEAD`;

  if (!(await gitOutput(["diff", "--name-only", diffRange])).trim()) {
    console.error(`No changes between ${branch} and ${target}.`);
    process.exit(1);
  }

  const diff = await relevantDiff([diffRange], { log });
  const template = await findTemplate({
    candidates: config.templateCandidates ?? [],
    dirs: config.templateDirs ?? [],
  });

  if (template) {
    console.log(`Using ${config.abbr} template: ${template.path}`);
  } else {
    console.log(`No ${config.abbr} template found, using default format.`);
  }

  const prompt = buildRequestPrompt(config, {
    template: template?.content,
    log,
    diff,
  });

  console.log(`Generating ${config.abbr} description with AI...`);
  const aiOutput = await aiGenerate(prompt, { model: "openai/gpt-5.5" });
  let title: string;
  let description: string;

  if (aiOutput.success) {
    [title, description] = splitTitleBody(aiOutput.text, branch);
  } else {
    console.error("Warning: AI generation failed, using commit log as description.");
    if (aiOutput.details.trim()) {
      console.error(aiOutput.details);
    }
    title =
      log
        .split(/\r?\n/, 1)[0]
        ?.trim()
        .replace(/^[a-f0-9]+\s+/, "") || branch;
    description = log;
  }

  console.log(`Creating ${config.abbr}: ${title}`);

  await gitOutput(["push", "-u", "origin", branch]);

  const request = config.create(title, description, target);
  const created = await runCommand(request.command, request.args);

  if (created.code !== 0) {
    console.error(`Error creating ${config.abbr}:`);
    if (created.output.trim()) {
      console.error(created.output.trimEnd());
    }
    process.exit(-1);
  }

  process.stdout.write(created.output);
}

function printHelp(config: ChangeRequestConfig): void {
  console.log(`Usage: git ${config.cmd} [options]

Create a ${config.noun} with an AI-generated description.

Options:
  -t, --target BRANCH  Target branch (default: auto-detect)
  -h, --help           Show this help`);
}

function buildRequestPrompt(
  config: ChangeRequestConfig,
  input: { template: string | undefined; log: string; diff: string },
): string {
  const sections: string[] = [];
  const intro = input.template
    ? `Fill in this ${config.nounShort} template based on the changes below.`
    : `Write a ${config.noun} description for these changes.`;
  const body = input.template
    ? `Everything after that is the filled template body. Plain text with markdown. Do not wrap in a code block.
Preserve the template's headings and their order. Replace placeholder comments (e.g. <!-- ... -->) with real content, and delete the comment markers.
Leave "N/A" where the diff does not tell you. Do not tick checkboxes unless the diff clearly satisfies them.`
    : "Everything after that is the description body with a summary section. Use markdown. Do not wrap in a code block.";

  sections.push(`${intro}
Output only the title and body — no preamble, explanation, or surrounding text.
The FIRST line of your output must be the ${config.abbr} title.
${titleStyle("title")}
The SECOND line must be blank.
${body}`);

  if (input.template) {
    sections.push(`Template:\n${input.template}`);
  }

  sections.push(`Commits:\n${input.log}`);
  sections.push(`Changes:\n${input.diff}`);

  return sections.join("\n\n");
}

async function findTemplate(input: {
  candidates: string[];
  dirs: string[];
}): Promise<Template | undefined> {
  const root = await repoRoot();
  if (!root) {
    return undefined;
  }

  for (const relativePath of input.candidates) {
    const path = join(root, relativePath);
    if (await fileExists(path)) {
      return { content: await readFile(path, "utf8"), path };
    }
  }

  for (const relativeDir of input.dirs) {
    const dir = join(root, relativeDir);
    if (!(await directoryExists(dir))) {
      continue;
    }

    const templates = (await readdir(dir, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => join(dir, entry.name))
      .sort();
    const path =
      templates.find((file) => basename(file).toLowerCase() === "default.md") ?? templates[0];

    if (path) {
      return { content: await readFile(path, "utf8"), path };
    }
  }

  return undefined;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}
