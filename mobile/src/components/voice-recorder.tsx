import { Ionicons } from '@expo/vector-icons';
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptic, PressScale } from '@/components/motion';
import { IconButton } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import { colors, radius, space, type } from '@/lib/theme';
import { MAX_VOICE_SECONDS, readAsBase64, VOICE_MIME, VOICE_OPTIONS } from '@/lib/voice';

const BARS = 18;

/**
 * Mic button; while recording it turns into a bar with a timer and live level bars.
 * onAudio gets the recording as base64 once the user taps send.
 */
export function useVoice(onAudio: (base64: string, mime: string) => void, onError: (msg: string) => void) {
  const { t } = useI18n();
  const recorder = useAudioRecorder({ ...VOICE_OPTIONS, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 120);
  const [active, setActive] = useState(false);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));

  // keep a short history of input levels for the bars
  useEffect(() => {
    if (!active) return;
    const db = state.metering ?? -60;
    const level = Math.max(0, Math.min(1, (db + 60) / 50));
    setLevels((l) => [...l.slice(1), level]);
  }, [state.durationMillis, state.metering, active]);

  const start = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        onError(t('coach.micDenied'));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      haptic('tap');
      setLevels(Array(BARS).fill(0));
      setActive(true);
    } catch {
      onError(t('coach.micFailed'));
    }
  };

  const stop = async (send: boolean) => {
    setActive(false);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!send) return;
      haptic('select');
      const uri = recorder.uri;
      if (!uri) throw new Error('no recording');
      onAudio(await readAsBase64(uri), VOICE_MIME);
    } catch {
      if (send) onError(t('coach.micFailed'));
    }
  };

  const sendRef = useRef(stop);
  sendRef.current = stop;
  useEffect(() => {
    if (active && state.durationMillis >= MAX_VOICE_SECONDS * 1000) sendRef.current(true);
  }, [active, state.durationMillis]);

  return { active, start, stop, seconds: Math.floor(state.durationMillis / 1000), levels };
}

export function RecordingBar({
  seconds,
  levels,
  onCancel,
  onSend,
}: {
  seconds: number;
  levels: number[];
  onCancel: () => void;
  onSend: () => void;
}) {
  const { t } = useI18n();
  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={styles.bar}>
      <IconButton icon="close" label={t('common.cancel')} size={40} onPress={onCancel} />
      <View style={styles.middle}>
        <RecDot />
        <Text style={[type.body, type.num, { fontWeight: '700', width: 44 }]}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </Text>
        <View style={styles.levels}>
          {levels.map((l, i) => (
            <Level key={i} value={l} />
          ))}
        </View>
      </View>
      <PressScale accessibilityRole="button" accessibilityLabel="send" onPress={onSend} scaleTo={0.88} style={styles.send}>
        <Ionicons name="arrow-up" size={22} color={colors.accentInk} />
      </PressScale>
    </Animated.View>
  );
}

function Level({ value }: { value: number }) {
  const h = useSharedValue(4);
  useEffect(() => {
    h.value = withSpring(4 + value * 22, { damping: 14, stiffness: 260 });
  }, [value, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[styles.level, style]} />;
}

function RecDot() {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.25, { duration: 650, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(4), paddingTop: space(2) },
  middle: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space(4),
    borderWidth: 1,
    borderColor: 'rgba(255,90,110,0.5)',
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF5A6E' },
  levels: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, height: 28 },
  level: { width: 3, borderRadius: 2, backgroundColor: colors.accent },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
