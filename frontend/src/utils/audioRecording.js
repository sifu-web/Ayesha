/**
 * Starts a microphone recording for voice notes (Diary + Songs), tuned to
 * sound like a normal phone voice-recorder app — not like a video-call mic.
 *
 * Earlier versions of this file turned on the browser's noiseSuppression /
 * echoCancellation constraints (and, before that, an extra custom DSP chain
 * on top of them). Both approaches made recordings sound processed —
 * muffled, "underwater", or robotic — because that software is designed for
 * live calls, not for capturing a clean voice note. A phone's native voice
 * recorder does none of that; it just captures the mic input cleanly.
 *
 * So this now requests the mic with that processing explicitly OFF, which
 * gives the same natural, un-processed sound as a normal recording app.
 * autoGainControl is left on since it only evens out volume (quiet vs loud)
 * without altering the tone of the voice, which is the part that plays well
 * with how phones normally record.
 *
 * Usage:
 *   const handle = await startCleanRecording();
 *   ...
 *   const blob = await handle.stop(); // Blob, type 'audio/webm' (or similar)
 *   handle.cancel(); // or: stop without keeping the recording
 */

// Prefer a widely-supported, decent-quality codec; fall back gracefully if
// the browser doesn't support MediaRecorder's mimeType option at all, or
// doesn't support any of these specific types.
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
];

function pickSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
  return PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export async function startCleanRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      // Off: these are call/meeting-oriented algorithms that make a voice
      // note sound processed rather than like a normal recording.
      noiseSuppression: false,
      echoCancellation: false,
      // On: just balances quiet/loud, doesn't change how the voice sounds.
      autoGainControl: true,
    },
  });

  const mimeType = pickSupportedMimeType();
  const recorderOptions = {
    ...(mimeType ? { mimeType } : {}),
    audioBitsPerSecond: 128000,
  };

  let recorder;
  try {
    recorder = new MediaRecorder(stream, recorderOptions);
  } catch (err) {
    // If the browser rejects our chosen options for any reason, fall back
    // to its own defaults rather than failing the recording entirely.
    recorder = new MediaRecorder(stream);
  }

  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  function teardown() {
    stream.getTracks().forEach((t) => t.stop());
  }

  let stopResolve;
  const stopped = new Promise((resolve) => {
    stopResolve = resolve;
  });
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    teardown();
    stopResolve(blob);
  };

  recorder.start();

  return {
    recorder,
    /** Stops recording and resolves with the recorded audio Blob. */
    stop() {
      if (recorder.state !== 'inactive') recorder.stop();
      return stopped;
    },
    /** Aborts the recording without keeping anything. */
    cancel() {
      chunks.length = 0;
      if (recorder.state !== 'inactive') recorder.stop();
      else teardown();
    },
  };
}
