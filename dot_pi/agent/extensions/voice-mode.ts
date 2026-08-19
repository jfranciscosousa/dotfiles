import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { isKeyRelease, isKeyRepeat, matchesKey } from "@earendil-works/pi-tui";
import { spawn, type ChildProcess } from "node:child_process";
import type { Readable } from "node:stream";

// Codex Desktop uses this undocumented endpoint for subscription-backed dictation.
const CHATGPT_TRANSCRIPTIONS_URL = "https://chatgpt.com/backend-api/transcribe";
const DEFAULT_MODEL = "gpt-4o-mini-transcribe";
const FRAME_BYTES = 960;
const MAX_AUDIO_BYTES = 24 * 1024 * 1024;
const MAX_RECORDING_MS = 5 * 60_000;
const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
const REALTIME_MODEL = "gpt-live-transcribe";
const REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`;
const SAMPLE_RATE = 24_000;
const STATUS_KEY = "voice-mode";
const TRANSCRIPTION_TIMEOUT_MS = 60_000;

type Phase = "cancelling" | "finishing" | "idle" | "listening" | "starting";

type RecorderExit = {
  code: number | null;
  error?: Error;
  signal: NodeJS.Signals | null;
};

type RecorderCommand = {
  args: string[];
  command: string;
};

type SessionCallbacks = {
  onFatal: (error: Error) => void;
  onText: (text: string) => void;
  onWarning: (error: Error) => void;
};

type TranscriptionAuth =
  | { apiKey: string; kind: "api" }
  | { accessToken: string; accountId?: string; kind: "codex" };

type TranscriptionResponse = {
  error?: { message?: string };
  text?: string;
};

type TranscriptItem = {
  text: string;
};

type VoiceSession = {
  readonly mode: "live" | "phrase";
  cancel(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<string>;
};

export default function (pi: ExtensionAPI) {
  let controller: VoiceController | undefined;

  pi.on("session_start", (_event, ctx) => {
    controller = new VoiceController(pi, ctx);
    controller.attach();
  });

  pi.on("session_shutdown", async () => {
    const activeController = controller;
    controller = undefined;
    await activeController?.dispose();
  });

  pi.registerCommand("voice", {
    description: "Start continuous voice dictation: /voice [cancel|status]",
    handler: async (args, ctx) => {
      if (!controller) {
        controller = new VoiceController(pi, ctx);
        controller.attach();
      }

      switch (args.trim().toLowerCase()) {
        case "":
          await controller.start();
          return;
        case "cancel":
          await controller.cancelAndRestore();
          return;
        case "status":
          controller.showStatus();
          return;
        default:
          ctx.ui.notify("Usage: /voice [cancel|status]", "warning");
      }
    },
  });
}

class VoiceController {
  private baseText = "";
  private cancelRequested = false;
  private readonly ctx: ExtensionContext;
  private disposed = false;
  private finishWhenStarted = false;
  private generation = 0;
  private readonly pi: ExtensionAPI;
  private phase: Phase = "idle";
  private session?: VoiceSession;
  private timeout?: ReturnType<typeof setTimeout>;
  private transcript = "";
  private unsubscribeInput?: () => void;

  constructor(pi: ExtensionAPI, ctx: ExtensionContext) {
    this.pi = pi;
    this.ctx = ctx;
  }

  attach(): void {
    if (this.ctx.mode !== "tui" || this.unsubscribeInput) return;
    this.unsubscribeInput = this.ctx.ui.onTerminalInput((data) => this.handleTerminalInput(data));
  }

  async start(): Promise<void> {
    if (this.phase !== "idle") {
      this.ctx.ui.notify("Voice mode is already active", "info");
      return;
    }
    if (this.ctx.mode !== "tui") {
      this.ctx.ui.notify("Voice mode requires Pi's interactive TUI", "warning");
      return;
    }

    const generation = ++this.generation;
    this.phase = "starting";
    this.cancelRequested = false;
    this.finishWhenStarted = false;
    this.transcript = "";
    const editorText = this.ctx.ui.getEditorText();
    this.baseText = /^\/voice(?:\s.*)?$/i.test(editorText.trim()) ? "" : editorText;
    this.setStatus("Preparing continuous voice mode…", "warning");

    let candidate: VoiceSession | undefined;
    try {
      const auth = await resolveTranscriptionAuth(this.ctx);
      if (!this.isCurrent(generation) || this.cancelRequested) return;

      const callbacks: SessionCallbacks = {
        onFatal: (error) => void this.handleSessionFailure(generation, error),
        onText: (text) => this.updateTranscript(generation, text),
        onWarning: (error) => {
          if (this.isCurrent(generation)) {
            this.ctx.ui.notify(`Voice transcription warning: ${error.message}`, "warning");
          }
        },
      };

      if (auth.kind === "api") {
        candidate = new RealtimeVoiceSession(auth.apiKey, callbacks);
        this.session = candidate;
        try {
          await candidate.start();
        } catch (error) {
          await candidate.cancel();
          if (this.session === candidate) this.session = undefined;
          candidate = undefined;
          if (!this.isCurrent(generation) || this.cancelRequested) return;
          this.ctx.ui.notify(
            `Realtime transcription unavailable; using phrase mode: ${errorMessage(error)}`,
            "warning",
          );
        }
      }

      if (!this.isCurrent(generation) || this.cancelRequested) {
        await candidate?.cancel();
        if (this.session === candidate) this.session = undefined;
        return;
      }

      if (!candidate) {
        candidate = new BatchVoiceSession(auth, callbacks);
        this.session = candidate;
        await candidate.start();
      }

      if (!this.isCurrent(generation) || this.cancelRequested) {
        await candidate.cancel();
        if (this.session === candidate) this.session = undefined;
        return;
      }

      this.phase = "listening";
      this.setStatus(
        `● Listening · ${candidate.mode === "live" ? "live" : "phrase"} · Enter sends · Esc cancels`,
        "error",
      );
      this.timeout = setTimeout(() => void this.stopAndKeep(generation), MAX_RECORDING_MS);

      if (this.finishWhenStarted) await this.finishAndSubmit(generation);
    } catch (error) {
      await candidate?.cancel();
      if (this.session === candidate) this.session = undefined;
      if (this.isCurrent(generation) && !this.cancelRequested && !this.disposed) {
        this.phase = "idle";
        this.clearStatus();
        this.ctx.ui.setEditorText(this.baseText);
        this.ctx.ui.notify(`Voice mode failed: ${errorMessage(error)}`, "error");
      }
    }
  }

  async cancelAndRestore(): Promise<void> {
    if (this.phase === "idle") {
      this.ctx.ui.notify("Voice mode is idle", "info");
      return;
    }
    if (this.phase === "cancelling") return;

    ++this.generation;
    this.cancelRequested = true;
    this.finishWhenStarted = false;
    this.phase = "cancelling";
    this.clearTimeout();
    this.setStatus("Cancelling voice mode…", "warning");

    const session = this.session;
    this.session = undefined;
    await session?.cancel();

    if (this.disposed) return;
    this.ctx.ui.setEditorText(this.baseText);
    this.transcript = "";
    this.phase = "idle";
    this.clearStatus();
    this.ctx.ui.notify("Voice mode cancelled", "info");
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    ++this.generation;
    this.cancelRequested = true;
    this.clearTimeout();
    this.unsubscribeInput?.();
    this.unsubscribeInput = undefined;

    const session = this.session;
    this.session = undefined;
    await session?.cancel();
    this.phase = "idle";
    this.clearStatus();
  }

  showStatus(): void {
    const mode = this.session?.mode ?? "not connected";
    this.ctx.ui.notify(`Voice mode: ${this.phase} · ${mode}`, "info");
  }

  private handleTerminalInput(data: string): { consume?: boolean } | undefined {
    if (this.phase === "idle") return undefined;
    if (isKeyRelease(data) || isKeyRepeat(data)) return { consume: true };

    if (matchesKey(data, "escape")) {
      void this.cancelAndRestore();
      return { consume: true };
    }

    if (matchesKey(data, "enter")) {
      if (this.phase === "starting") this.finishWhenStarted = true;
      else if (this.phase === "listening") void this.finishAndSubmit(this.generation);
      return { consume: true };
    }

    return { consume: true };
  }

  private async finishAndSubmit(generation: number): Promise<void> {
    if (!this.isCurrent(generation) || this.phase !== "listening") return;

    this.phase = "finishing";
    this.clearTimeout();
    this.setStatus("Finalizing voice transcript…", "warning");

    const session = this.session;
    let finalizationFailed = false;
    try {
      const finalTranscript = await session?.stop();
      if (finalTranscript) this.updateTranscript(generation, finalTranscript);
    } catch (error) {
      finalizationFailed = true;
      if (this.isCurrent(generation)) {
        this.ctx.ui.notify(
          `Could not finalize voice transcript: ${errorMessage(error)}`,
          "warning",
        );
      }
    } finally {
      if (this.session === session) this.session = undefined;
    }

    if (!this.isCurrent(generation) || this.disposed) return;
    const message = composeEditorText(this.baseText, this.transcript);
    this.phase = "idle";
    this.clearStatus();

    if (finalizationFailed) {
      this.ctx.ui.notify("The partial transcript was kept but not sent", "warning");
      return;
    }

    if (!message.trim()) {
      this.ctx.ui.setEditorText(this.baseText);
      this.ctx.ui.notify("No speech was detected", "warning");
      return;
    }

    this.ctx.ui.setEditorText("");
    try {
      this.pi.sendUserMessage(message);
    } catch (error) {
      this.ctx.ui.setEditorText(message);
      this.ctx.ui.notify(`Could not send voice message: ${errorMessage(error)}`, "error");
    }
  }

  private async stopAndKeep(generation: number): Promise<void> {
    if (!this.isCurrent(generation) || this.phase !== "listening") return;

    this.phase = "finishing";
    this.clearTimeout();
    this.setStatus("Finalizing voice transcript…", "warning");
    const session = this.session;

    try {
      const finalTranscript = await session?.stop();
      if (finalTranscript) this.updateTranscript(generation, finalTranscript);
    } catch (error) {
      if (this.isCurrent(generation)) {
        this.ctx.ui.notify(
          `Could not finalize voice transcript: ${errorMessage(error)}`,
          "warning",
        );
      }
    } finally {
      if (this.session === session) this.session = undefined;
    }

    if (!this.isCurrent(generation) || this.disposed) return;
    this.phase = "idle";
    this.clearStatus();
    this.ctx.ui.notify(
      "Voice mode stopped at the five-minute limit; the transcript was kept",
      "warning",
    );
  }

  private async handleSessionFailure(generation: number, error: Error): Promise<void> {
    if (!this.isCurrent(generation) || this.phase === "idle" || this.disposed) return;

    ++this.generation;
    this.clearTimeout();
    const session = this.session;
    this.session = undefined;
    await session?.cancel();
    this.phase = "idle";
    this.clearStatus();
    this.ctx.ui.notify(`Voice mode stopped: ${error.message}`, "error");
  }

  private updateTranscript(generation: number, transcript: string): void {
    if (!this.isCurrent(generation) || this.disposed) return;
    this.transcript = transcript.trim();
    this.ctx.ui.setEditorText(composeEditorText(this.baseText, this.transcript));
  }

  private isCurrent(generation: number): boolean {
    return generation === this.generation && !this.disposed;
  }

  private clearTimeout(): void {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = undefined;
  }

  private setStatus(message: string, color: "error" | "warning"): void {
    this.ctx.ui.setStatus(STATUS_KEY, this.ctx.ui.theme.fg(color, message));
  }

  private clearStatus(): void {
    this.ctx.ui.setStatus(STATUS_KEY, undefined);
  }
}

class RealtimeVoiceSession implements VoiceSession {
  readonly mode = "live" as const;
  private audioSinceCommit = false;
  private readonly callbacks: SessionCallbacks;
  private cancelled = false;
  private finalizationError?: Error;
  private readonly items = new Map<string, TranscriptItem>();
  private readonly itemOrder: string[] = [];
  private readonly pendingItems = new Set<string>();
  private readyReject?: (error: Error) => void;
  private readyResolve?: () => void;
  private recorder?: RawRecorder;
  private readonly apiKey: string;
  private socket?: WebSocket;
  private stopping = false;
  private waitingForCommit = false;

  constructor(apiKey: string, callbacks: SessionCallbacks) {
    this.apiKey = apiKey;
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    const socket = new WebSocket(REALTIME_URL, [
      "realtime",
      `openai-insecure-api-key.${this.apiKey}`,
    ]);
    this.socket = socket;
    socket.addEventListener("message", (event) => this.handleMessage(event));
    socket.addEventListener("error", () =>
      this.handleSocketFailure(new Error("Realtime connection failed")),
    );
    socket.addEventListener("close", () =>
      this.handleSocketFailure(new Error("Realtime connection closed unexpectedly")),
    );

    await waitForWebSocketOpen(socket);
    const ready = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    socket.send(
      JSON.stringify({
        type: "session.update",
        session: {
          type: "transcription",
          audio: {
            input: {
              format: { type: "audio/pcm", rate: SAMPLE_RATE },
              transcription: { model: REALTIME_MODEL },
              turn_detection: {
                type: "server_vad",
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
                threshold: 0.5,
              },
            },
          },
        },
      }),
    );

    await withTimeout(ready, 10_000, "Realtime transcription setup timed out");
    if (this.cancelled) return;

    const recorder = await RawRecorder.start(
      (audio) => this.sendAudio(audio),
      (error) => this.fail(error),
    );
    if (this.cancelled) {
      await recorder.stop();
      return;
    }
    this.recorder = recorder;
  }

  async stop(): Promise<string> {
    if (this.stopping) return this.transcript();
    this.stopping = true;
    await this.recorder?.stop();
    this.recorder = undefined;

    if (this.audioSinceCommit && this.socket?.readyState === WebSocket.OPEN) {
      this.waitingForCommit = true;
      this.socket.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    }

    try {
      const completed = await waitForCondition(
        () => !this.waitingForCommit && this.pendingItems.size === 0,
        5_000,
        300,
      );
      if (this.finalizationError) throw this.finalizationError;
      if (!completed) throw new Error("Realtime transcription finalization timed out");
      return this.transcript();
    } finally {
      this.closeSocket();
    }
  }

  async cancel(): Promise<void> {
    if (this.cancelled) return;
    this.cancelled = true;
    this.stopping = true;
    this.readyReject?.(new Error("Realtime transcription cancelled"));
    this.readyReject = undefined;
    this.readyResolve = undefined;
    this.waitingForCommit = false;
    this.pendingItems.clear();
    await this.recorder?.stop();
    this.recorder = undefined;
    this.closeSocket();
  }

  private sendAudio(audio: Buffer): void {
    const socket = this.socket;
    if (this.cancelled || !socket || socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > 2 * 1024 * 1024) {
      this.fail(new Error("Realtime transcription could not keep up with microphone audio"));
      return;
    }

    socket.send(
      JSON.stringify({
        type: "input_audio_buffer.append",
        audio: audio.toString("base64"),
      }),
    );
    this.audioSinceCommit = true;
  }

  private handleMessage(event: MessageEvent): void {
    const payload = parseRealtimeEvent(event.data);
    if (!payload) return;

    const type = typeof payload.type === "string" ? payload.type : "";
    if (type === "session.updated") {
      this.readyResolve?.();
      this.readyResolve = undefined;
      this.readyReject = undefined;
      return;
    }

    if (type === "error") {
      const message = realtimeErrorMessage(payload);
      if (this.readyReject) {
        this.readyReject(new Error(message));
        this.readyReject = undefined;
        this.readyResolve = undefined;
      } else if (message.includes("buffer_commit_empty")) {
        this.waitingForCommit = false;
      } else if (this.stopping) {
        this.finalizationError = new Error(message);
        this.waitingForCommit = false;
        this.pendingItems.clear();
      } else {
        this.fail(new Error(message));
      }
      return;
    }

    if (type === "input_audio_buffer.committed") {
      this.audioSinceCommit = false;
      this.waitingForCommit = false;
      if (typeof payload.item_id === "string") this.pendingItems.add(payload.item_id);
    }

    if (type === "conversation.item.input_audio_transcription.failed") {
      const itemId = typeof payload.item_id === "string" ? payload.item_id : "current";
      this.pendingItems.delete(itemId);
      const error = new Error(realtimeErrorMessage(payload));
      if (this.stopping) this.finalizationError = error;
      else this.fail(error);
      return;
    }

    if (
      type !== "conversation.item.input_audio_transcription.delta" &&
      type !== "conversation.item.input_audio_transcription.completed"
    ) {
      return;
    }

    const itemId = typeof payload.item_id === "string" ? payload.item_id : "current";
    this.pendingItems.add(itemId);
    let item = this.items.get(itemId);
    if (!item) {
      item = { text: "" };
      this.items.set(itemId, item);
      this.itemOrder.push(itemId);
    }

    if (type.endsWith(".delta") && typeof payload.delta === "string") {
      item.text += payload.delta;
    }
    if (type.endsWith(".completed") && typeof payload.transcript === "string") {
      item.text = payload.transcript;
      this.pendingItems.delete(itemId);
    }

    this.callbacks.onText(this.transcript());
  }

  private transcript(): string {
    return joinTranscriptParts(this.itemOrder.map((itemId) => this.items.get(itemId)?.text ?? ""));
  }

  private handleSocketFailure(error: Error): void {
    if (this.cancelled) return;
    if (this.stopping) {
      this.finalizationError = error;
      this.waitingForCommit = false;
      this.pendingItems.clear();
      return;
    }
    if (this.readyReject) {
      this.readyReject(error);
      this.readyReject = undefined;
      this.readyResolve = undefined;
      return;
    }
    this.fail(error);
  }

  private fail(error: Error): void {
    if (this.stopping || this.cancelled) return;
    this.stopping = true;
    this.callbacks.onFatal(error);
  }

  private closeSocket(): void {
    const socket = this.socket;
    this.socket = undefined;
    if (socket && socket.readyState < WebSocket.CLOSING) {
      try {
        socket.close(1000);
      } catch {
        // The socket can still be inside its opening handshake during cancellation.
      }
    }
  }
}

class BatchVoiceSession implements VoiceSession {
  readonly mode = "phrase" as const;
  private readonly abort = new AbortController();
  private readonly allAudio: Buffer[] = [];
  private readonly auth: TranscriptionAuth;
  private readonly callbacks: SessionCallbacks;
  private cancelled = false;
  private enqueuedPhrases = 0;
  private parts: string[] = [];
  private queue: Promise<void> = Promise.resolve();
  private recorder?: RawRecorder;
  private segmenter?: PhraseSegmenter;
  private stopping = false;
  private totalBytes = 0;

  constructor(auth: TranscriptionAuth, callbacks: SessionCallbacks) {
    this.auth = auth;
    this.callbacks = callbacks;
  }

  async start(): Promise<void> {
    this.segmenter = new PhraseSegmenter((audio) => this.enqueue(audio));
    if (this.cancelled) return;

    const recorder = await RawRecorder.start(
      (audio) => this.handleAudio(audio),
      (error) => this.callbacks.onFatal(error),
    );
    if (this.cancelled) {
      await recorder.stop();
      return;
    }
    this.recorder = recorder;
  }

  async stop(): Promise<string> {
    if (this.stopping) return joinTranscriptParts(this.parts);
    this.stopping = true;
    await this.recorder?.stop();
    this.recorder = undefined;
    this.segmenter?.flush();

    if (this.enqueuedPhrases === 0 && this.totalBytes >= FRAME_BYTES) {
      this.enqueue(Buffer.concat(this.allAudio));
    }

    await this.queue;
    return joinTranscriptParts(this.parts);
  }

  async cancel(): Promise<void> {
    if (this.cancelled) return;
    this.cancelled = true;
    this.stopping = true;
    this.abort.abort();
    await this.recorder?.stop();
    this.recorder = undefined;
    await this.queue;
  }

  private handleAudio(audio: Buffer): void {
    if (this.cancelled) return;
    this.totalBytes += audio.length;
    if (this.totalBytes > MAX_AUDIO_BYTES) {
      this.callbacks.onFatal(new Error("Voice recording exceeded 24 MB"));
      return;
    }

    this.allAudio.push(audio);
    this.segmenter?.push(audio);
  }

  private enqueue(audio: Buffer): void {
    if (this.cancelled || audio.length < FRAME_BYTES) return;
    this.enqueuedPhrases += 1;
    this.queue = this.queue.then(async () => {
      if (this.cancelled) return;
      try {
        const transcript = await transcribe(this.auth, wavFromPcm(audio), this.abort.signal);
        if (!transcript || this.cancelled) return;
        this.parts.push(transcript);
        this.callbacks.onText(joinTranscriptParts(this.parts));
      } catch (error) {
        if (!this.cancelled) this.callbacks.onWarning(toError(error));
      }
    });
  }
}

class PhraseSegmenter {
  private activeFrames: Buffer[] = [];
  private readonly emit: (audio: Buffer) => void;
  private frameCount = 0;
  private preRoll: Buffer[] = [];
  private remainder = Buffer.alloc(0);
  private silenceFrames = 0;
  private speaking = false;

  constructor(emit: (audio: Buffer) => void) {
    this.emit = emit;
  }

  push(chunk: Buffer): void {
    this.remainder = Buffer.concat([this.remainder, chunk]);
    while (this.remainder.length >= FRAME_BYTES) {
      const frame = this.remainder.subarray(0, FRAME_BYTES);
      this.remainder = this.remainder.subarray(FRAME_BYTES);
      this.pushFrame(frame);
    }
  }

  flush(): void {
    if (this.speaking && this.activeFrames.length > 0) {
      this.emit(Buffer.concat(this.activeFrames));
    }
    this.reset();
  }

  private pushFrame(frame: Buffer): void {
    const speech = pcmRms(frame) >= 400;

    if (!this.speaking) {
      this.preRoll.push(frame);
      if (this.preRoll.length > 10) this.preRoll.shift();
      if (!speech) return;

      this.speaking = true;
      this.activeFrames = [...this.preRoll];
      this.preRoll = [];
      this.frameCount = this.activeFrames.length;
      this.silenceFrames = 0;
      return;
    }

    this.activeFrames.push(frame);
    this.frameCount += 1;
    this.silenceFrames = speech ? 0 : this.silenceFrames + 1;

    if (this.silenceFrames >= 30 || this.frameCount >= 500) {
      this.emit(Buffer.concat(this.activeFrames));
      this.reset();
    }
  }

  private reset(): void {
    this.activeFrames = [];
    this.frameCount = 0;
    this.preRoll = [];
    this.silenceFrames = 0;
    this.speaking = false;
  }
}

class RawRecorder {
  private readonly child: ChildProcess;
  private readonly exit: Promise<RecorderExit>;
  private readonly stdoutClosed: Promise<void>;
  private stopping = false;
  private stopTask?: Promise<void>;

  private constructor(
    child: ChildProcess,
    exit: Promise<RecorderExit>,
    stdoutClosed: Promise<void>,
  ) {
    this.child = child;
    this.exit = exit;
    this.stdoutClosed = stdoutClosed;
  }

  static async start(
    onAudio: (audio: Buffer) => void,
    onFatal: (error: Error) => void,
  ): Promise<RawRecorder> {
    const command = rawRecorderCommand();
    const child = spawn(command.command, command.args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const { exit, getStderr } = observeRecorder(child);
    const stdoutClosed = observeStreamClose(child.stdout);
    await waitForSpawn(child);

    const recorder = new RawRecorder(child, exit, stdoutClosed);
    child.stdout?.on("data", (chunk: Buffer) => onAudio(chunk));
    void exit.then((result) => {
      if (!recorder.stopping) onFatal(new Error(recorderExitMessage(result, getStderr())));
    });
    return recorder;
  }

  stop(): Promise<void> {
    if (this.stopTask) return this.stopTask;

    this.stopping = true;
    this.child.kill("SIGINT");
    this.stopTask = (async () => {
      await waitForChildProcess(this.child, this.exit);
      await waitBounded(this.stdoutClosed, 1_000);
    })();
    return this.stopTask;
  }
}

function rawRecorderCommand(): RecorderCommand {
  if (process.platform === "linux") {
    return {
      command: "pw-record",
      args: ["--raw", `--rate=${SAMPLE_RATE}`, "--channels=1", "--format=s16", "-"],
    };
  }

  if (process.platform === "darwin") {
    return {
      command: "rec",
      args: [
        "-q",
        "-t",
        "raw",
        "-r",
        String(SAMPLE_RATE),
        "-c",
        "1",
        "-b",
        "16",
        "-e",
        "signed-integer",
        "-",
      ],
    };
  }

  throw new Error(`voice recording is not supported on ${process.platform}`);
}

function observeStreamClose(stream: Readable | null): Promise<void> {
  if (!stream) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    stream.once("end", finish);
    stream.once("close", finish);
    stream.once("error", finish);
  });
}

function observeRecorder(child: ChildProcess): {
  exit: Promise<RecorderExit>;
  getStderr: () => string;
} {
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer | string) => {
    if (stderr.length < 8_192) stderr += chunk.toString().slice(0, 8_192 - stderr.length);
  });

  const exit = new Promise<RecorderExit>((resolve) => {
    let settled = false;
    const finish = (result: RecorderExit) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    child.once("error", (error) => finish({ code: null, error, signal: null }));
    child.once("exit", (code, signal) => finish({ code, signal }));
  });

  return { exit, getStderr: () => stderr.trim() };
}

async function waitForSpawn(child: ChildProcess): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      child.off("spawn", onSpawn);
      reject(error);
    };
    const onSpawn = () => {
      child.off("error", onError);
      resolve();
    };

    child.once("error", onError);
    child.once("spawn", onSpawn);
  });
}

async function waitForChildProcess(
  child: ChildProcess,
  exit: Promise<RecorderExit>,
): Promise<RecorderExit> {
  const timeout = Symbol("recorder-timeout");
  const result = await Promise.race([
    exit,
    new Promise<typeof timeout>((resolve) => setTimeout(() => resolve(timeout), 3_000)),
  ]);
  if (result !== timeout) return result;

  child.kill("SIGKILL");
  const killTimeout = Symbol("recorder-kill-timeout");
  const killed = await Promise.race([
    exit,
    new Promise<typeof killTimeout>((resolve) => setTimeout(() => resolve(killTimeout), 1_000)),
  ]);
  return killed === killTimeout ? { code: null, signal: "SIGKILL" } : killed;
}

async function resolveTranscriptionAuth(ctx: ExtensionContext): Promise<TranscriptionAuth> {
  const environmentKey = process.env.OPENAI_API_KEY?.trim();
  if (environmentKey) return { apiKey: environmentKey, kind: "api" };

  const configuredKey = await ctx.modelRegistry.getApiKeyForProvider("openai");
  if (configuredKey) return { apiKey: configuredKey, kind: "api" };

  const accessToken = await ctx.modelRegistry.getApiKeyForProvider("openai-codex");
  if (accessToken) {
    return {
      accessToken,
      accountId: getCodexAccountId(accessToken),
      kind: "codex",
    };
  }

  throw new Error("configure OpenAI API credentials or sign in to OpenAI Codex in Pi");
}

async function transcribe(
  auth: TranscriptionAuth,
  audio: Buffer,
  signal: AbortSignal,
): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "recording.wav");
  if (auth.kind === "api") form.append("model", DEFAULT_MODEL);

  const timeoutSignal = AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS);
  const requestSignal = AbortSignal.any([signal, timeoutSignal]);
  let response: Response;

  try {
    response = await fetch(
      auth.kind === "api" ? OPENAI_TRANSCRIPTIONS_URL : CHATGPT_TRANSCRIPTIONS_URL,
      {
        method: "POST",
        headers:
          auth.kind === "api"
            ? { authorization: `Bearer ${auth.apiKey}` }
            : {
                authorization: `Bearer ${auth.accessToken}`,
                ...(auth.accountId ? { "chatgpt-account-id": auth.accountId } : {}),
                originator: "Codex Desktop",
                "user-agent": `Codex Desktop/1.0.0 (${process.platform}; ${process.arch})`,
              },
        body: form,
        signal: requestSignal,
      },
    );
  } catch (error) {
    if (signal.aborted) throw new Error("transcription cancelled");
    if (timeoutSignal.aborted) throw new Error("OpenAI transcription timed out after 60 seconds");
    throw error;
  }

  const body = await response.text();
  let payload: TranscriptionResponse;
  try {
    payload = JSON.parse(body) as TranscriptionResponse;
  } catch {
    throw new Error(`OpenAI returned an invalid response (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `${response.status} ${response.statusText}`);
  }

  return payload.text?.trim() ?? "";
}

function wavFromPcm(pcm: Buffer): Buffer {
  const header = Buffer.alloc(44);
  const bytesPerSecond = SAMPLE_RATE * 2;
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(bytesPerSecond, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function pcmRms(frame: Buffer): number {
  let sum = 0;
  const samples = Math.floor(frame.length / 2);
  for (let offset = 0; offset + 1 < frame.length; offset += 2) {
    const sample = frame.readInt16LE(offset);
    sum += sample * sample;
  }
  return samples > 0 ? Math.sqrt(sum / samples) : 0;
}

function parseRealtimeEvent(data: unknown): Record<string, unknown> | undefined {
  if (typeof data !== "string") return undefined;
  try {
    const payload = JSON.parse(data) as unknown;
    return payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function realtimeErrorMessage(payload: Record<string, unknown>): string {
  const error = payload.error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Realtime transcription failed";
}

async function waitForWebSocketOpen(socket: WebSocket): Promise<void> {
  await withTimeout(
    new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("Realtime connection failed")), {
        once: true,
      });
      socket.addEventListener(
        "close",
        () => reject(new Error("Realtime connection closed before setup completed")),
        { once: true },
      );
    }),
    10_000,
    "Realtime connection timed out",
  );
}

async function waitForCondition(
  condition: () => boolean,
  maxWaitMs: number,
  minWaitMs = 0,
): Promise<boolean> {
  const startedAt = Date.now();
  return new Promise<boolean>((resolve) => {
    const check = () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= minWaitMs && condition()) {
        resolve(true);
        return;
      }
      if (elapsed >= maxWaitMs) {
        resolve(false);
        return;
      }
      setTimeout(check, 50);
    };
    setTimeout(check, Math.min(50, minWaitMs));
  });
}

async function waitBounded(promise: Promise<void>, timeoutMs: number): Promise<void> {
  await Promise.race([promise, new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))]);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function composeEditorText(baseText: string, transcript: string): string {
  if (!transcript) return baseText;
  if (!baseText) return transcript;
  return `${baseText}${/\s$/.test(baseText) ? "" : " "}${transcript}`;
}

function joinTranscriptParts(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function getCodexAccountId(token: string): string | undefined {
  try {
    const payload = token.split(".")[1];
    if (!payload) return undefined;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      "https://api.openai.com/auth"?: { chatgpt_account_id?: unknown };
    };
    const accountId = claims["https://api.openai.com/auth"]?.chatgpt_account_id;
    return typeof accountId === "string" && accountId ? accountId : undefined;
  } catch {
    return undefined;
  }
}

function recorderExitMessage(result: RecorderExit, stderr: string): string {
  if (result.error) return result.error.message;
  if (stderr) return stderr;
  if (result.signal) return `recorder terminated by ${result.signal}`;
  return `recorder exited with code ${result.code ?? "unknown"}`;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
