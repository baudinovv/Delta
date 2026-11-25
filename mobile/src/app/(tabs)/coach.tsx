import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';

import Animated, { FadeIn, FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';

import { ActionChips } from '@/components/coach-actions';
import { Appear, haptic, PressScale, TypingDots } from '@/components/motion';
import { RecordingBar, useVoice } from '@/components/voice-recorder';
import { Banner, ErrorText, IconButton, Loading, Screen } from '@/components/ui';
import { api, type CoachMessage } from '@/lib/api';
import { errorText, useI18n } from '@/lib/i18n';
import { useToken } from '@/lib/session';
import { colors, radius, space, type } from '@/lib/theme';

const clean = (s: string) => s.replace(/\*\*/g, '').replace(/^#+\s*/gm, '');

export default function CoachScreen() {
  const token = useToken();
  const { t, lang } = useI18n();
  const params = useLocalSearchParams<{ ask?: string }>();
  const [messages, setMessages] = useState<CoachMessage[] | null>(null);
  const [demo, setDemo] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  /** Messages already on screen when the chat opened don't animate in; only new ones do. */
  const seen = useRef(new Set<string>());

  const load = useCallback(async () => {
    try {
      const thread = await api.coachThread(token);
      thread.messages.forEach((m) => seen.current.add(m.id));
      setMessages(thread.messages);
      setDemo(thread.demo);
      setError(null);
    } catch (e) {
      setError(errorText(e, t));
      setMessages((m) => m ?? []);
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const send = async (raw?: string) => {
    const q = (raw ?? text).trim();
    if (!q || sending) return;
    const pending: CoachMessage = { id: `local-${Date.now()}`, role: 'user', content: q, createdAt: new Date().toISOString() };
    setMessages((m) => [...(m ?? []), pending]);
    setText('');
    setSending(true);
    setError(null);
    try {
      haptic('tap');
      const reply = await api.askCoach(token, q, lang);
      setMessages((m) => [...(m ?? []), reply]);
      if (reply.actions?.length) haptic('success');
    } catch (e) {
      setMessages((m) => (m ?? []).filter((x) => x.id !== pending.id));
      setText(q);
      setError(errorText(e, t));
    } finally {
      setSending(false);
    }
  };

  /** Voice: show "Recognizing…" right away, then swap in what was heard and the reply. */
  const sendVoice = async (base64: string, mime: string) => {
    const pending: CoachMessage = {
      id: `voice-${Date.now()}`,
      role: 'user',
      content: t('coach.listening'),
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...(m ?? []), pending]);
    setSending(true);
    setError(null);
    try {
      const r = await api.askCoachVoice(token, base64, mime, lang);
      setMessages((m) => [...(m ?? []).map((x) => (x.id === pending.id ? { ...x, content: r.transcript } : x)), r.reply]);
      if (r.reply.actions?.length) haptic('success');
    } catch (e) {
      setMessages((m) => (m ?? []).filter((x) => x.id !== pending.id));
      setError(errorText(e, t));
    } finally {
      setSending(false);
    }
  };

  const voice = useVoice(sendVoice, setError);

  // "Ask the coach to make a plan" from the workout tab lands here with ?ask=…
  useFocusEffect(
    useCallback(() => {
      if (params.ask && messages != null && !sending) {
        const q = params.ask;
        router.setParams({ ask: undefined });
        send(q);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.ask, messages == null]),
  );

  const clear = async () => {
    try {
      await api.clearCoach(token);
      setMessages([]);
    } catch (e) {
      setError(errorText(e, t));
    }
  };

  const suggestions = [t('coach.s1'), t('coach.s2'), t('coach.s3'), t('coach.s4')];
  const empty = messages != null && messages.length === 0;

  return (
    <Screen
      scroll={false}
      subtitle={t('coach.sub')}
      title={t('coach.title')}
      right={
        messages && messages.length > 0 ? (
          <IconButton icon="trash-outline" label={t('coach.clear')} onPress={clear} />
        ) : undefined
      }>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled">
          {demo && <Banner tone="warn" icon="flask" text={t('common.demo')} />}

          {messages == null && <Loading compact />}

          {empty && (
            <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(150)} style={styles.empty}>
              <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.avatarLg}>
                <Ionicons name="sparkles" size={28} color={colors.accentInk} />
              </Animated.View>
              <Text style={[type.body, { textAlign: 'center', color: colors.muted }]}>{t('coach.empty')}</Text>
              <View style={styles.voiceHint}>
                <Ionicons name="mic" size={16} color={colors.accent} />
                <Text style={[type.small, { flex: 1 }]}>{t('coach.voiceHint')}</Text>
              </View>
              <View style={styles.suggestions}>
                {suggestions.map((s, i) => (
                  <Appear key={s} index={i + 2}>
                    <PressScale
                      accessibilityRole="button"
                      onPress={() => send(s)}
                      hapticKind="tap"
                      style={styles.suggestion}>
                      <Text style={[type.body, { flex: 1, fontSize: 15 }]}>{s}</Text>
                      <Ionicons name="arrow-forward" size={16} color={colors.accent} />
                    </PressScale>
                  </Appear>
                ))}
              </View>
            </Animated.View>
          )}

          {messages?.map((m) =>
            m.role === 'user' ? (
              <Animated.View
                key={m.id}
                entering={seen.current.has(m.id) ? undefined : FadeInDown.springify().damping(16)}
                style={[styles.bubble, styles.mine]}>
                <Text style={[type.body, { color: colors.accentInk }]}>{m.content}</Text>
              </Animated.View>
            ) : (
              <Animated.View
                key={m.id}
                entering={seen.current.has(m.id) ? undefined : FadeInDown.duration(350)}
                style={styles.coachRow}>
                <View style={styles.avatar}>
                  <Ionicons name="sparkles" size={14} color={colors.accentInk} />
                </View>
                <View style={styles.coachColumn}>
                  <View style={[styles.bubble, styles.theirs, { maxWidth: '100%' }]}>
                    <Text style={[type.body, { lineHeight: 23 }]} selectable>
                      {clean(m.content)}
                    </Text>
                  </View>
                  {m.actions && m.actions.length > 0 && <ActionChips actions={m.actions} />}
                </View>
              </Animated.View>
            ),
          )}

          {sending && (
            <Animated.View entering={FadeIn.delay(150)} exiting={FadeOut.duration(120)} style={styles.coachRow}>
              <View style={styles.avatar}>
                <Ionicons name="sparkles" size={14} color={colors.accentInk} />
              </View>
              <View
                style={[styles.bubble, styles.theirs]}
                accessibilityLabel={t('coach.thinking')}
                accessibilityLiveRegion="polite">
                <TypingDots color={colors.muted} />
              </View>
            </Animated.View>
          )}

          <ErrorText message={error} />
        </ScrollView>

        {voice.active ? (
          <RecordingBar
            seconds={voice.seconds}
            levels={voice.levels}
            onCancel={() => voice.stop(false)}
            onSend={() => voice.stop(true)}
          />
        ) : (
          <View style={styles.inputBar}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('coach.placeholder')}
              placeholderTextColor={colors.faint}
              style={styles.input}
              multiline
              maxLength={2000}
              onSubmitEditing={() => send()}
              blurOnSubmit={Platform.OS === 'web'}
            />
            {text.trim() ? (
              <IconButton icon="arrow-up" label="send" tone="accent" size={44} onPress={() => send()} />
            ) : (
              <IconButton icon="mic" label="voice" tone="surface" size={44} onPress={() => !sending && voice.start()} />
            )}
          </View>
        )}
        <Text style={styles.disclaimer}>{t('coach.disclaimer')}</Text>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: space(4), gap: space(3), paddingBottom: space(4), flexGrow: 1 },
  empty: { alignItems: 'center', gap: space(4), paddingTop: space(8) },
  avatarLg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestions: { alignSelf: 'stretch', gap: space(2), marginTop: space(2) },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space(4),
  },
  bubble: { maxWidth: '86%', borderRadius: radius.lg, paddingHorizontal: space(4), paddingVertical: space(3) },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.surface, borderBottomLeftRadius: 6, flexShrink: 1 },
  coachColumn: { flexShrink: 1, maxWidth: '86%', gap: space(1) },
  voiceHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: space(3),
    alignSelf: 'stretch',
  },
  coachRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space(2) },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space(2),
    paddingHorizontal: space(4),
    paddingTop: space(2),
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: space(4),
    paddingTop: 12,
    paddingBottom: 12,
  },
  disclaimer: { ...type.small, fontSize: 11, textAlign: 'center', color: colors.faint, paddingVertical: space(2) },
});
