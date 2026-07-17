import { createDraftId } from "./draft.js";
import type { AnswerValue } from "./types.js";
import type { WebAttachmentBinaryStore } from "./web-attachments.js";

export interface WebStoredAudioReference {
  [key: string]: unknown;
  id: string;
  uri: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  durationMs: number;
  processed: true;
}

export interface WebAudioRecordingSession {
  stop(): Promise<AnswerValue>;
  cancel(): void;
}

export interface StartWebAudioRecordingOptions {
  store: WebAttachmentBinaryStore;
  mediaDevices?: Pick<MediaDevices, "getUserMedia"> | undefined;
  MediaRecorderClass?: typeof MediaRecorder | undefined;
  createId?: (() => string) | undefined;
  now?: (() => number) | undefined;
}

function preferredAudioMimeType(MediaRecorderClass: typeof MediaRecorder): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
  return candidates.find((mimeType) => MediaRecorderClass.isTypeSupported?.(mimeType));
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

export async function startWebAudioRecording(options: StartWebAudioRecordingOptions): Promise<WebAudioRecordingSession> {
  const mediaDevices = options.mediaDevices ?? globalThis.navigator?.mediaDevices;
  const MediaRecorderClass = options.MediaRecorderClass ?? globalThis.MediaRecorder;
  if (!mediaDevices?.getUserMedia || !MediaRecorderClass) {
    throw new Error("Audio recording is not supported by this browser.");
  }

  const stream = await mediaDevices.getUserMedia({ audio: true });
  const mimeType = preferredAudioMimeType(MediaRecorderClass);
  let recorder: MediaRecorder;
  try {
    recorder = mimeType ? new MediaRecorderClass(stream, { mimeType }) : new MediaRecorderClass(stream);
    recorder.start();
  } catch (error) {
    stopStream(stream);
    throw error;
  }

  const chunks: Blob[] = [];
  const startedAt = (options.now ?? Date.now)();
  let cancelled = false;
  let stopping: Promise<AnswerValue> | undefined;
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  return {
    stop() {
      stopping ??= new Promise<AnswerValue>((resolve, reject) => {
        recorder.addEventListener("error", () => {
          stopStream(stream);
          reject(new Error("The browser could not complete the audio recording."));
        }, { once: true });
        recorder.addEventListener("stop", async () => {
          stopStream(stream);
          if (cancelled) return;
          const recordedMimeType = recorder.mimeType || mimeType || chunks[0]?.type || "audio/webm";
          const blob = new Blob(chunks, { type: recordedMimeType });
          if (blob.size === 0) {
            reject(new Error("No audio was recorded. Check the microphone and try again."));
            return;
          }
          const id = (options.createId ?? createDraftId)();
          const name = `${id}.${extensionForMimeType(recordedMimeType)}`;
          try {
            await options.store.save(id, blob);
            resolve({
              id,
              uri: `who-va-attachment:${id}`,
              name,
              originalName: name,
              mimeType: recordedMimeType,
              size: blob.size,
              durationMs: Math.max(0, (options.now ?? Date.now)() - startedAt),
              processed: true
            } satisfies WebStoredAudioReference);
          } catch (error) {
            reject(new Error("The audio recording could not be saved on this device.", { cause: error }));
          }
        }, { once: true });
        recorder.stop();
      });
      return stopping;
    },
    cancel() {
      cancelled = true;
      if (recorder.state !== "inactive") recorder.stop();
      stopStream(stream);
    }
  };
}
