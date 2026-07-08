export type Source = "claude" | "opencode" | "pi";

export type Bucket = {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  cost: number;
};

export type Usage = {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
};

export type Rates = {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
};

export type SessionCost = {
  source: Source;
  sessionId: string;
  cwd?: string;
  date?: string;
  title?: string;
  branchCounts: Record<string, number>;
  modelCosts: Record<string, number>;
  bucket: Bucket;
};

export type SourceData = {
  source: Source;
  label: string;
  sessions: SessionCost[];
  messageCount: number;
  fileCount: number;
  extraRepos: string[];
};

export type CostCalculator = (
  model: string,
  input: number,
  output: number,
  cacheWrite: number,
  cacheRead: number,
) => number;

export type CollectOptions = {
  since: string;
  sinceTimeMs: number;
  costFor: CostCalculator;
};

export type CommandResult = {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};
