// Hold to hum's microphone (W6): the iPhone's audio session is named play-and-record before the microphone is asked
// for, and given back however the hold ends: refused, or stopped.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startHum } from '../../src/ui/songs/hum';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function fakeRecorder(opts: { throws?: boolean } = {}) {
  const track = { stop: vi.fn() };
  class Rec {
    state = 'inactive'; mimeType = 'audio/mp4'; ondataavailable: ((e: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null;
    static isTypeSupported = () => true;
    constructor() { if (opts.throws) throw new DOMException('no', 'NotSupportedError'); }
    start() { this.state = 'recording'; this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])]) }); }
    stop() { this.state = 'inactive'; this.onstop?.(); }
  }
  vi.stubGlobal('MediaRecorder', Rec);
  return track;
}

describe('the hum and the audio session', () => {
  it('a recorder that cannot start: the microphone is closed and the session given back', async () => {
    const session = { type: 'auto' };
    const track = fakeRecorder({ throws: true });
    vi.stubGlobal('navigator', { audioSession: session, mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track] }) } });
    await expect(startHum({ onFrame: () => undefined })).rejects.toThrow();
    expect(track.stop).toHaveBeenCalled();
    expect(session.type).toBe('auto');
  });

  it('three minutes is the most a take keeps: at the cap it says so and stops by itself, the microphone closed', async () => {
    vi.useFakeTimers();
    const session = { type: 'auto' };
    const track = fakeRecorder();
    vi.stubGlobal('navigator', { audioSession: session, mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track] }) } });
    const onCap = vi.fn();
    const h = await startHum({ onFrame: () => undefined, onCap });
    vi.advanceTimersByTime(179_000);
    expect(onCap).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(onCap).toHaveBeenCalledTimes(1);
    const t = await h.stop();
    expect(t!.seconds).toBeLessThanOrEqual(180);
    expect(track.stop).toHaveBeenCalled();
    expect(session.type).toBe('auto');
    vi.useRealTimers();
  });

  it('refused: the session was play-and-record when the microphone was asked for, and is auto again after', async () => {
    const session = { type: 'auto' };
    let atAsk = '';
    vi.stubGlobal('navigator', { audioSession: session, mediaDevices: { getUserMedia: async () => { atAsk = session.type; throw new DOMException('no', 'NotAllowedError'); } } });
    await expect(startHum({ onFrame: () => undefined })).rejects.toThrow();
    expect(atAsk).toBe('play-and-record');
    expect(session.type).toBe('auto');
  });

  it('a take stopped gives the session back', async () => {
    const session = { type: 'auto' };
    const track = { stop: vi.fn() };
    vi.stubGlobal('navigator', { audioSession: session, mediaDevices: { getUserMedia: async () => ({ getTracks: () => [track] }) } });
    class Rec {
      state = 'inactive'; mimeType = 'audio/mp4'; ondataavailable: ((e: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null;
      static isTypeSupported = () => true;
      start() { this.state = 'recording'; this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])]) }); }
      stop() { this.state = 'inactive'; this.onstop?.(); }
    }
    vi.stubGlobal('MediaRecorder', Rec);
    const h = await startHum({ onFrame: () => undefined });
    expect(session.type).toBe('play-and-record');
    const t = await h.stop();
    expect(t?.audioType).toBe('audio/mp4');
    expect(track.stop).toHaveBeenCalled();
    expect(session.type).toBe('auto');
  });
});
