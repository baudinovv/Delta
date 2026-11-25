import { AudioQuality, IOSOutputFormat, type RecordingOptions } from 'expo-audio';
import { Platform } from 'react-native';

/**
 * Voice notes for the AI coach, in formats Gemini transcribes reliably (checked: wav, aac, webm/opus).
 * 16 kHz mono is plenty for speech and keeps a 30-second note small.
 */
export const VOICE_OPTIONS: RecordingOptions = {
  extension: Platform.OS === 'ios' ? '.wav' : '.aac',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 48000,
  ios: {
    extension: '.wav',
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MEDIUM,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    extension: '.aac',
    outputFormat: 'aac_adts',
    audioEncoder: 'aac',
  },
  // no bitsPerSecond: MediaRecorder splits it between audio and (absent) video and clamps speech to ~5 kbps
  web: { mimeType: 'audio/webm' },
};

export const VOICE_MIME = Platform.OS === 'ios' ? 'audio/wav' : Platform.OS === 'android' ? 'audio/aac' : 'audio/webm';

export const MAX_VOICE_SECONDS = 60;

/** Reads a recording (file:// on the phone, blob: on web) as base64. */
export async function readAsBase64(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
