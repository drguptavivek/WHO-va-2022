// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { startWebAudioRecording } from "../src/web-audio.js";
import type { WebAttachmentBinaryStore } from "../src/web-attachments.js";

function memoryStore(): WebAttachmentBinaryStore & { saved: Map<string, Blob> } {
  const saved = new Map<string, Blob>();
  return {
    saved,
    async save(id, blob) { saved.set(id, blob); },
    async load(id) { return saved.get(id); },
    async remove(id) { saved.delete(id); }
  };
}

class FakeMediaRecorder extends EventTarget {
  static isTypeSupported(mimeType: string): boolean {
    return mimeType === "audio/webm;codecs=opus";
  }

  readonly mimeType: string;
  state: RecordingState = "inactive";

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    super();
    this.mimeType = options?.mimeType ?? "";
  }

  start(): void {
    this.state = "recording";
  }

  stop(): void {
    this.state = "inactive";
    const dataEvent = new Event("dataavailable") as Event & { data: Blob };
    dataEvent.data = new Blob(["recorded audio"], { type: this.mimeType });
    this.dispatchEvent(dataEvent);
    this.dispatchEvent(new Event("stop"));
  }
}

describe("web audio recording", () => {
  it("records, stops the microphone, and stores a durable audio reference", async () => {
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const store = memoryStore();
    const times = [1_000, 3_500];

    const recording = await startWebAudioRecording({
      store,
      mediaDevices: { getUserMedia } as Pick<MediaDevices, "getUserMedia">,
      MediaRecorderClass: FakeMediaRecorder as unknown as typeof MediaRecorder,
      createId: () => "audio-id",
      now: () => times.shift() ?? 3_500
    });
    const answer = await recording.stop();

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(answer).toEqual({
      id: "audio-id",
      uri: "who-va-attachment:audio-id",
      name: "audio-id.webm",
      originalName: "audio-id.webm",
      mimeType: "audio/webm;codecs=opus",
      size: 14,
      durationMs: 2_500,
      processed: true
    });
    expect(store.saved.get("audio-id")?.type).toBe("audio/webm;codecs=opus");
    expect(stopTrack).toHaveBeenCalled();
  });

  it("reports unsupported browsers without requesting a microphone", async () => {
    await expect(startWebAudioRecording({
      store: memoryStore(),
      mediaDevices: undefined,
      MediaRecorderClass: undefined
    })).rejects.toThrow("Audio recording is not supported");
  });
});
