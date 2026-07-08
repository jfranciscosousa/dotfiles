import {
  chunks,
  detectDefaultBranch,
  firstJsonArrayObject,
  hasCommand,
  nestedStringField,
  nonEmptyStringField,
  objectValue,
} from "./utils.ts";

type BranchRow = {
  name: string;
  rel: string;
};

type ReviewInfo = {
  url: string;
  author?: string;
};

const REMOTE_CHUNK_SIZE = 16;
const GREEN = "\u001b[32m";
const BLUE = "\u001b[34m";
const RESET = "\u001b[0m";

if (argv.h || argv.help) {
  printHelp();
  process.exit(0);
}

const loadRemotes = Boolean(argv.r || argv.remotes);
const defaultBranch = await detectDefaultBranch();
const current = (await $`git rev-parse --abbrev-ref HEAD`.quiet().nothrow()).stdout.trim();
const format = "%(refname:short)|%(committerdate:relative)";
const refs = await $`git for-each-ref --sort=-committerdate refs/heads/ --format=${format}`
  .quiet()
  .nothrow();
const rows = refs.stdout
  .split(/\r?\n/)
  .map(parseBranchRow)
  .filter((row): row is BranchRow => row !== undefined);
const defaultRow = rows.find((row) => row.name === defaultBranch);
const defaultName = defaultRow ? defaultBranch : undefined;
const others = rows.filter((row) => row.name !== defaultName);
const ordered = defaultRow ? [defaultRow, ...others] : others;

if (ordered.length > 0) {
  const { urls, me } = loadRemotes
    ? await fetchRemoteData(ordered, defaultName)
    : { urls: new Map<string, ReviewInfo>(), me: undefined };

  const nameWidth = Math.max(...ordered.map((row) => row.name.length));
  const relWidth = Math.max(...ordered.map((row) => row.rel.length));

  for (const row of ordered) {
    const marker = row.name === current ? "*" : " ";
    let line = `${marker} ${row.name.padEnd(nameWidth)}  ${row.rel.padEnd(relWidth)}`;
    const info = urls.get(row.name);

    if (info) {
      if (info.author) {
        const isMe = me !== undefined && info.author === me;
        const handle = isMe ? "@me" : `@${info.author}`;
        const color = isMe ? GREEN : BLUE;
        line += `  by: ${color}${handle}${RESET}`;
      }

      line += `  ${info.url}`;
    }

    console.log(line);
  }
}

function printHelp(): void {
  console.log(`Usage: git better-branch [-r]

List branches with latest commit time; -r also fetches PR/MR URLs.

Options:
  -r, --remotes  Fetch PR/MR URLs from GitHub/GitLab
  -h, --help     Show this help`);
}

function parseBranchRow(line: string): BranchRow | undefined {
  if (!line.trim()) {
    return undefined;
  }

  const separator = line.indexOf("|");
  const name = separator === -1 ? line.trim() : line.slice(0, separator).trim();

  if (!name) {
    return undefined;
  }

  return {
    name,
    rel: separator === -1 ? "" : line.slice(separator + 1).trim(),
  };
}

async function fetchRemoteData(
  ordered: BranchRow[],
  defaultName: string | undefined,
): Promise<{ urls: Map<string, ReviewInfo>; me: string | undefined }> {
  const remote = await $`git remote get-url origin`.quiet().nothrow();
  const remoteUrl = remote.stdout.trim();

  if (!remoteUrl) {
    console.warn("git-better-branch: no 'origin' remote; skipping PR/MR fetch.");
    return { urls: new Map<string, ReviewInfo>(), me: undefined };
  }

  const branches = ordered.map((row) => row.name).filter((name) => name !== defaultName);
  const [urls, me] = await Promise.all([fetchReviewUrls(remoteUrl, branches), fetchMe(remoteUrl)]);

  return { urls, me };
}

async function fetchReviewUrls(
  remoteUrl: string,
  branches: string[],
): Promise<Map<string, ReviewInfo>> {
  if (remoteUrl.includes("github")) {
    return fetchGithubUrls(branches);
  }

  if (remoteUrl.includes("gitlab")) {
    return fetchGitlabUrls(branches);
  }

  return new Map();
}

async function fetchBranchReviewUrls(
  branches: string[],
  command: string,
  fetchReview: (branch: string) => Promise<{ branch: string; info: ReviewInfo } | undefined>,
): Promise<Map<string, ReviewInfo>> {
  const urls = new Map<string, ReviewInfo>();

  if (branches.length === 0 || !(await hasCommand(command))) {
    return urls;
  }

  for (const chunk of chunks(branches, REMOTE_CHUNK_SIZE)) {
    const entries = await Promise.all(chunk.map(fetchReview));

    for (const entry of entries) {
      if (entry) {
        urls.set(entry.branch, entry.info);
      }
    }
  }

  return urls;
}

async function fetchGithubUrls(branches: string[]): Promise<Map<string, ReviewInfo>> {
  return fetchBranchReviewUrls(branches, "gh", fetchGithubUrl);
}

async function fetchGithubUrl(
  branch: string,
): Promise<{ branch: string; info: ReviewInfo } | undefined> {
  try {
    const out = await $`gh pr list --head ${branch} --state open --json url,author --limit 1`
      .quiet()
      .nothrow();

    if (!out.ok) {
      return undefined;
    }

    const pr = firstJsonArrayObject(out.stdout);
    const url = pr ? nonEmptyStringField(pr, "url") : undefined;

    if (!url) {
      return undefined;
    }

    return {
      branch,
      info: {
        url,
        author: pr ? nestedStringField(pr, "author", "login") : undefined,
      },
    };
  } catch {
    return undefined;
  }
}

async function fetchGitlabUrls(branches: string[]): Promise<Map<string, ReviewInfo>> {
  return fetchBranchReviewUrls(branches, "glab", fetchGitlabUrl);
}

async function fetchGitlabUrl(
  branch: string,
): Promise<{ branch: string; info: ReviewInfo } | undefined> {
  try {
    const endpoint = `projects/:fullpath/merge_requests?state=opened&source_branch=${encodeURIComponent(
      branch,
    )}&per_page=1`;
    const out = await $`glab api ${endpoint}`.quiet().nothrow();

    if (!out.ok) {
      return undefined;
    }

    const mr = firstJsonArrayObject(out.stdout);
    const url = mr ? nonEmptyStringField(mr, "web_url") : undefined;

    if (!url) {
      return undefined;
    }

    return {
      branch,
      info: {
        url,
        author: mr ? nestedStringField(mr, "author", "username") : undefined,
      },
    };
  } catch {
    return undefined;
  }
}

async function fetchMe(remoteUrl: string): Promise<string | undefined> {
  if (remoteUrl.includes("github")) {
    if (!(await hasCommand("gh"))) {
      return undefined;
    }

    const out = await $`gh api user --jq .login`.quiet().nothrow();
    const login = out.stdout.trim();
    return out.ok && login ? login : undefined;
  }

  if (remoteUrl.includes("gitlab")) {
    if (!(await hasCommand("glab"))) {
      return undefined;
    }

    const out = await $`glab api user`.quiet().nothrow();
    if (!out.ok) {
      return undefined;
    }

    try {
      const user = objectValue(JSON.parse(out.stdout));
      return user ? nonEmptyStringField(user, "username") : undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export {};
