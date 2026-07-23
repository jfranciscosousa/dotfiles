import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { cwd } from "node:process";
import { $ } from "zx";

export type FileGroups = {
  oxfmt: Set<string>;
  taplo: Set<string>;
  oxlint: Set<string>;
  shellBash: Set<string>;
  shellSh: Set<string>;
  zsh: Set<string>;
};

const root = cwd();
const ignoredDirectories = new Set([".git", "node_modules"]);
const ignoredFiles = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);
const oxfmtExtensions = new Set([
  ".cjs",
  ".css",
  ".cts",
  ".gql",
  ".graphql",
  ".html",
  ".js",
  ".json",
  ".json5",
  ".jsonc",
  ".jsx",
  ".less",
  ".md",
  ".mdx",
  ".mjs",
  ".mts",
  ".scss",
  ".toml",
  ".ts",
  ".tsx",
  ".vue",
  ".yaml",
  ".yml",
]);
const oxlintExtensions = new Set([".cjs", ".cts", ".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);

export function createGroups(): FileGroups {
  return {
    oxfmt: new Set(),
    taplo: new Set(),
    oxlint: new Set(),
    shellBash: new Set(),
    shellSh: new Set(),
    zsh: new Set(),
  };
}

export function discoverSourceFiles(directory = "."): string[] {
  const files: string[] = [];
  const entries = readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    if (
      entry.name.startsWith(".") &&
      entry.name !== ".chezmoitemplates" &&
      entry.name !== ".husky"
    ) {
      const file = join(directory, entry.name);
      if (entry.isFile()) {
        files.push(toRelativePath(file));
      }
      continue;
    }

    if (entry.isDirectory()) {
      if (!shouldIgnoreDirectory(directory, entry.name)) {
        files.push(...discoverSourceFiles(join(directory, entry.name)));
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(toRelativePath(join(directory, entry.name)));
    }
  }

  return files.sort();
}

export function classifyFiles(files: string[]): FileGroups {
  const groups = createGroups();

  for (const input of files) {
    classifyFile(toRelativePath(input), groups);
  }

  return groups;
}

export async function formatGroups(groups: FileGroups): Promise<void> {
  await runIfAny(["oxfmt", "--write", "--disable-nested-config"], groups.oxfmt);
}

export async function lintGroups(groups: FileGroups): Promise<void> {
  await validateChezmoiState();
  await runIfAny(["oxfmt", "--check", "--disable-nested-config"], groups.oxfmt);
  await runIfAny(["taplo", "check"], groups.taplo);
  await runIfAny(["oxlint"], groups.oxlint);
  await runIfAny(["shellcheck", "--shell=bash"], groups.shellBash);
  await runIfAny(["shellcheck", "--shell=sh"], groups.shellSh);

  for (const file of sorted(groups.zsh)) {
    console.log(`\n==> zsh -n ${file}`);
    await $`zsh -n ${file}`;
  }
}

function classifyFile(file: string, groups: FileGroups): void {
  if (!existsSync(file) || shouldIgnoreFile(file)) {
    return;
  }

  const extension = extname(file).toLowerCase();
  const shebang = firstLine(file);
  const isChezMoiModifyTemplate = shebang.includes("chezmoi:modify-template");

  if (oxfmtExtensions.has(extension) && !isChezMoiModifyTemplate) {
    groups.oxfmt.add(file);
  }

  if (extension === ".toml") {
    groups.taplo.add(file);
  }

  if (oxlintExtensions.has(extension)) {
    groups.oxlint.add(file);
  }

  const shell = shellFor(file, shebang);
  if (shell === "bash") {
    groups.shellBash.add(file);
  } else if (shell === "sh") {
    groups.shellSh.add(file);
  } else if (shell === "zsh") {
    groups.zsh.add(file);
  }
}

function shellFor(file: string, shebang: string): "bash" | "sh" | "zsh" | undefined {
  if (!shebang.startsWith("#!")) {
    if (isZshPath(file)) {
      return "zsh";
    }

    return file.endsWith(".sh") ? "bash" : undefined;
  }

  if (shebang.includes("bash")) {
    return "bash";
  }

  if (shebang.includes("zsh")) {
    return "zsh";
  }

  if (shebang.match(/#!.*\bsh\b/)) {
    return "sh";
  }

  if (isZshPath(file)) {
    return "zsh";
  }

  if (file.endsWith(".sh")) {
    return "bash";
  }

  return undefined;
}

function isZshPath(file: string): boolean {
  return /^(?:dot_zlogin|dot_zpreztorc|dot_zprofile|dot_zshenv|dot_zsh\/|dot_claude\/executable_shell-init\.sh$)/.test(
    file,
  );
}

function shouldIgnoreFile(file: string): boolean {
  return ignoredFiles.has(file) || file.endsWith(".tmpl") || file.startsWith("node_modules/");
}

function shouldIgnoreDirectory(parent: string, name: string): boolean {
  return ignoredDirectories.has(name) || join(parent, name) === ".husky/_";
}

function firstLine(file: string): string {
  return readFileSync(file, "utf8").split(/\r?\n/, 1)[0] ?? "";
}

function toRelativePath(file: string): string {
  const absolute = isAbsolute(file) ? file : resolve(file);
  const relativePath = relative(root, absolute);
  return relativePath.startsWith("..") || isAbsolute(relativePath) ? file : relativePath;
}

function sorted(files: Set<string>): string[] {
  return [...files].sort();
}

async function validateChezmoiState(): Promise<void> {
  console.log("\n==> chezmoi apply --dry-run --no-tty --refresh-externals=never");
  await $`chezmoi apply --dry-run --no-tty --refresh-externals=never --source ${root}`;
}

async function runIfAny(command: string[], files: Set<string>): Promise<void> {
  const list = sorted(files);
  if (list.length === 0) {
    return;
  }

  console.log(`\n==> ${[...command, ...list].join(" ")}`);
  await $`${command} ${list}`;
}
