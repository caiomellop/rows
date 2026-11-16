import { STT_SAMPLE_RATE, TTS_SAMPLE_RATE } from "./deepgram-urls";

/**
 * Browser audio, nothing else: the microphone as 16 kHz PCM frames for speech recognition, and a
 * player for the voice's 24 kHz PCM that knows how much of the message has actually been heard.
 * Needs a secure page (https or localhost) and a click, so it only runs from the Start button.
 */

/** Microphone frames are 80 ms long. */
const FRAME_SAMPLES = (STT_SAMPLE_RATE * 80) / 1000;

// Runs on the audio thread. Resamples the microphone to 16 kHz by averaging (a cheap low-pass filter
// before dropping samples) and posts 80 ms frames of 16-bit mono PCM.
const CAPTURE_WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / ${STT_SAMPLE_RATE};
    this.input = [];
    this.pos = 0;
    this.frame = new Int16Array(${FRAME_SAMPLES});
    this.filled = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) this.input.push(channel[i]);
    while (this.pos + this.ratio <= this.input.length) {
      const from = Math.floor(this.pos);
      const to = Math.max(from + 1, Math.floor(this.pos + this.ratio));
      let sum = 0;
      for (let i = from; i < to; i++) sum += this.input[i];
      const value = Math.max(-1, Math.min(1, sum / (to - from)));
      this.frame[this.filled++] = value < 0 ? value * 0x8000 : value * 0x7fff;
      this.pos += this.ratio;
      if (this.filled === this.frame.length) {
        this.port.postMessage(this.frame.slice().buffer);
        this.filled = 0;
      }
    }
    const drop = Math.floor(this.pos);
    if (drop > 0) {
      this.input = this.input.slice(drop);
      this.pos -= drop;
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
`;

export type Mic = { stop(): void };

export async function startMic(onFrame: (pcm: ArrayBuffer) => void): Promise<Mic> {
  // Echo cancellation matters: the interviewer's voice comes out of the same device. Headphones are still best.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const context = new AudioContext({ latencyHint: "interactive" });
  const release = () => {
    for (const track of stream.getTracks()) track.stop();
    void context.close();
  };

  try {
    await context.resume();
    const url = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: "application/javascript" }));
    try {
      await context.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    const source = context.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(context, "pcm-capture", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => onFrame(event.data);
    // Some browsers only run a node that reaches the speakers. A muted gain keeps it running without a sound.
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(node);
    node.connect(mute);
    mute.connect(context.destination);
    return {
      stop() {
        source.disconnect();
        node.disconnect();
        mute.disconnect();
        release();
      },
    };
  } catch (error) {
    release();
    throw error;
  }
}

/** What the interview loop needs from a player, so tests can use a fake. */
export interface Player {
  /** Starts a new message: the next audio begins a fresh timeline. */
  begin(): void;
  /** Queues PCM audio. For the first audio of a message, returns when it is expected to be heard (performance.now()). */
  enqueue(frame: ArrayBuffer): { audibleAt: number } | null;
  /** Milliseconds of this message the listener has heard so far. */
  playedMs(): number;
  /** Fades out and stops everything queued. */
  stop(): void;
  /** Resolves when all queued audio has finished playing. */
  whenDrained(): Promise<void>;
  close(): void;
}

export class PcmPlayer implements Player {
  private readonly context: AudioContext;
  private gain: GainNode;
  private readonly sources = new Set<AudioBufferSourceNode>();
  private drainWaiters: (() => void)[] = [];
  private nextStart = 0;
  private messageStart: number | null = null;
  private scheduledSeconds = 0;
  private carry: Uint8Array | null = null;

  /** Create it inside the click that starts the interview, so the browser lets it play. */
  constructor() {
    this.context = new AudioContext({ sampleRate: TTS_SAMPLE_RATE, latencyHint: "interactive" });
    void this.context.resume();
    this.gain = this.newGain();
  }

  private newGain(): GainNode {
    const gain = this.context.createGain();
    gain.connect(this.context.destination);
    return gain;
  }

  /** Time between the audio being scheduled and the listener hearing it. */
  private get outputLatency(): number {
    return this.context.outputLatency || this.context.baseLatency || 0;
  }

  begin(): void {
    this.messageStart = null;
    this.scheduledSeconds = 0;
    this.nextStart = 0;
    this.carry = null;
    this.gain = this.newGain();
  }

  enqueue(frame: ArrayBuffer): { audibleAt: number } | null {
    const bytes = this.wholeSamples(frame);
    if (!bytes) return null;

    const samples = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
    const buffer = this.context.createBuffer(1, samples.length, TTS_SAMPLE_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) channel[i] = samples[i] / 32768;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain);

    const first = this.messageStart === null;
    // Back to back with the previous piece; a short lead for the first one avoids a click.
    const startAt = Math.max(this.context.currentTime + (first ? 0.02 : 0), this.nextStart);
    source.start(startAt);
    this.nextStart = startAt + buffer.duration;
    this.scheduledSeconds += buffer.duration;
    if (first) this.messageStart = startAt;

    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      if (this.sources.size === 0) this.resolveDrain();
    };

    return first ? { audibleAt: performance.now() + (startAt - this.context.currentTime + this.outputLatency) * 1000 } : null;
  }

  playedMs(): number {
    if (this.messageStart === null) return 0;
    const heard = this.context.currentTime - this.outputLatency - this.messageStart;
    return Math.max(0, Math.min(heard, this.scheduledSeconds)) * 1000;
  }

  stop(): void {
    const gain = this.gain;
    const sources = [...this.sources];
    this.sources.clear();
    gain.gain.setTargetAtTime(0, this.context.currentTime, 0.015);
    setTimeout(() => {
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          // It had already ended.
        }
        source.disconnect();
      }
      gain.disconnect();
    }, 80);
    this.messageStart = null;
    this.scheduledSeconds = 0;
    this.carry = null;
    this.resolveDrain();
  }

  whenDrained(): Promise<void> {
    if (this.sources.size === 0) return Promise.resolve();
    return new Promise((resolve) => this.drainWaiters.push(resolve));
  }

  close(): void {
    this.resolveDrain();
    void this.context.close();
  }

  private resolveDrain() {
    const waiters = this.drainWaiters;
    this.drainWaiters = [];
    for (const resolve of waiters) resolve();
  }

  /** Network frames can split a 16-bit sample in two: hold the odd byte for the next frame. */
  private wholeSamples(frame: ArrayBuffer): Uint8Array | null {
    let bytes = new Uint8Array(frame);
    if (this.carry) {
      const joined = new Uint8Array(this.carry.length + bytes.length);
      joined.set(this.carry);
      joined.set(bytes, this.carry.length);
      bytes = joined;
      this.carry = null;
    }
    if (bytes.length % 2 === 1) {
      this.carry = bytes.slice(bytes.length - 1);
      bytes = bytes.slice(0, bytes.length - 1);
    }
    return bytes.length > 0 ? bytes : null;
  }
}
