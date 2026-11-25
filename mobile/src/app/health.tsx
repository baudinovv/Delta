import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { BarChart } from '@/components/charts';
import { CountUp, haptic } from '@/components/motion';
import { Banner, Button, Card, Choice, ErrorText, Loading, Screen } from '@/components/ui';
import { api, type HealthStatus, type HealthSummary } from '@/lib/api';
import { health, isConnected, setConnected, syncNow, type HealthAvailability } from '@/lib/health/sync';
import { errorText, useI18n } from '@/lib/i18n';
import { useToken } from '@/lib/session';
import { colors, radius, space, type } from '@/lib/theme';

const RED = '#FF5A6E';

/** Apple Health (iOS) / Health Connect (Android): consent, connect, sync, and what came in. */
export default function HealthScreen() {
  const token = useToken();
  const { t, ex, locale } = useI18n();
  const appName =
    Platform.OS === 'ios' ? t('hl.appleHealth') : Platform.OS === 'android' ? t('hl.healthConnect') : 'Apple Health / Health Connect';

  const [availability, setAvailability] = useState<HealthAvailability | null>(null);
  const [local, setLocal] = useState(false);
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState<'connect' | 'sync' | 'today' | 'off' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleFor = useCallback(
    (exercises: string[]) => `Delta · ${exercises.map(ex).join(', ')}`.slice(0, 80),
    [ex],
  );

  const load = useCallback(async () => {
    try {
      const [a, l, s, sum] = await Promise.all([
        health.availability(),
        isConnected(),
        api.healthStatus(token),
        api.healthSummary(token, 7),
      ]);
      setAvailability(a);
      setLocal(l);
      setStatus(s);
      setSummary(sum);
    } catch (e) {
      setError(errorText(e, t));
    }
  }, [token, t]);

  useEffect(() => {
    load();
  }, [load]);

  const sync = async (includeToday: boolean) => {
    setBusy(includeToday ? 'today' : 'sync');
    setError(null);
    setNote(null);
    try {
      const r = await syncNow(token, titleFor, includeToday);
      haptic('success');
      setNote(includeToday ? t('hl.exported', { app: appName }) : t('hl.synced', { n: r.read }));
      await load();
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    setBusy('connect');
    setError(null);
    setDenied(false);
    try {
      await api.healthConsent(token, true);
      const ok = await health.requestPermissions();
      if (!ok) {
        setDenied(true);
        setBusy(null);
        await load();
        return;
      }
      await setConnected(true);
      await syncNow(token, titleFor);
      haptic('success');
      await load();
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy('off');
    try {
      await api.healthConsent(token, false);
      await setConnected(false);
      setAgree(false);
      await load();
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(null);
    }
  };

  if (!availability || !status) return <Loading />;

  const ready = availability === 'ready';
  const on = status.consent && (local || !ready);
  const hasData = status.consent && summary && (summary.days.some((d) => d.steps != null) || summary.workouts.length > 0);
  const dayLabels = (summary?.days ?? []).map((d) =>
    new Date(`${d.date}T12:00:00`).toLocaleDateString(locale, { weekday: 'short' }).replace('.', '').slice(0, 2),
  );
  const lastSync = status.syncedAt
    ? new Date(status.syncedAt).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <Screen inStack onRefresh={load}>
      <Card style={{ gap: space(3) }}>
        <View style={styles.head}>
          <View style={styles.heart}>
            <Ionicons name="heart" size={22} color="#fff" />
          </View>
          <Text style={[type.h2, { flex: 1 }]}>{appName}</Text>
          <View style={[styles.pill, on && { backgroundColor: colors.accentSoft }]}>
            <View style={[styles.dot, { backgroundColor: on ? colors.accent : colors.faint }]} />
            <Text style={[type.small, { fontSize: 12, color: on ? colors.accent : colors.muted, fontWeight: '700' }]}>
              {on ? t('hl.connected') : t('hl.notConnected')}
            </Text>
          </View>
        </View>
        <Text style={type.small}>{t('hl.lead')}</Text>
      </Card>

      {availability === 'needs-build' && <Banner icon="phone-portrait-outline" text={t('hl.needsBuild', { app: appName })} />}
      {availability === 'unsupported' && <Banner icon="phone-portrait-outline" text={t('hl.unsupported')} />}
      {(availability === 'install-app' || availability === 'update-app') && (
        <Card style={{ gap: space(3) }}>
          <Text style={type.body}>{availability === 'install-app' ? t('hl.installApp') : t('hl.updateApp')}</Text>
          <Button title={t('hl.install')} icon="logo-google-playstore" onPress={() => health.openFix?.(availability)} />
        </Card>
      )}

      {ready && !on && (
        <Card style={{ gap: space(4) }}>
          <Row icon="download-outline" title={t('hl.reads')} text={t('hl.readsList')} />
          <Row icon="push-outline" title={t('hl.writes')} text={t('hl.writesList')} />
          <Row icon="lock-closed-outline" title="" text={t('hl.privacy')} />
          <Choice label={t('hl.agree')} selected={agree} onPress={() => setAgree((a) => !a)} />
          {denied && (
            <View style={{ gap: space(2) }}>
              <Banner tone="warn" icon="hand-left-outline" text={t('hl.denied', { app: appName })} />
              {health.openFix && (
                <Button title={t('hl.openSettings')} variant="secondary" size="md" onPress={() => health.openFix?.('ready')} />
              )}
            </View>
          )}
          <Button title={t('hl.connect')} icon="link" onPress={connect} loading={busy === 'connect'} disabled={!agree} />
        </Card>
      )}

      <ErrorText message={error} />
      {note && <Banner icon="checkmark-circle" text={note} />}

      {status.consent && !ready && hasData && <Text style={type.small}>{t('hl.dataFrom')}</Text>}

      {status.consent && summary && hasData && (
        <>
          <View style={styles.stats}>
            <Card style={styles.stat}>
              <Ionicons name="footsteps" size={18} color={colors.accent} />
              <Text style={[type.display, { fontSize: 28 }]}>
                <CountUp value={summary.stepsToday ?? 0} />
              </Text>
              <Text style={[type.small, { fontSize: 12 }]}>{t('hl.stepsToday')}</Text>
            </Card>
            <Card style={styles.stat}>
              <Ionicons name="flame" size={18} color={colors.fat} />
              <Text style={[type.display, { fontSize: 28 }]}>
                <CountUp value={summary.activeKcalToday ?? 0} />
              </Text>
              <Text style={[type.small, { fontSize: 12 }]}>{t('hl.activeToday')}</Text>
            </Card>
          </View>

          <Card style={{ gap: space(3) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={type.caption}>{t('hl.steps7')}</Text>
              {summary.avgSteps != null && <Text style={type.small}>{t('hl.avgSteps', { n: summary.avgSteps })}</Text>}
            </View>
            <BarChart
              values={summary.days.map((d) => d.steps ?? 0)}
              labels={dayLabels}
              target={10000}
              color={colors.accent}
              format={(n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))}
            />
          </Card>

          <Card style={{ gap: space(1) }}>
            <Text style={[type.caption, { marginBottom: space(1) }]}>{t('hl.watchWorkouts')}</Text>
            {summary.workouts.length === 0 ? (
              <Text style={type.small}>{t('hl.noWorkouts')}</Text>
            ) : (
              summary.workouts.map((w, i) => (
                <Animated.View
                  key={`${w.start}-${i}`}
                  entering={FadeInDown.delay(i * 50)}
                  style={[styles.workout, i > 0 && styles.divider]}>
                  <View style={styles.workoutIcon}>
                    <Ionicons name="fitness" size={18} color={RED} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={1}>
                      {prettyType(w.type)}
                    </Text>
                    <Text style={[type.small, { fontSize: 12 }]} numberOfLines={1}>
                      {new Date(w.start).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
                      {w.source ? ` · ${w.source}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[type.body, type.num, { fontWeight: '700' }]}>
                      {w.minutes} {t('hl.min')}
                    </Text>
                    <Text style={[type.small, type.num, { fontSize: 12 }]}>
                      {[w.energyKcal != null ? `${w.energyKcal} ${t('common.kcal')}` : null, w.avgHr ? `${w.avgHr} ${t('hl.bpm')}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                </Animated.View>
              ))
            )}
          </Card>
        </>
      )}

      {on && (
        <Animated.View entering={FadeIn} style={{ gap: space(2) }}>
          {lastSync && <Text style={[type.small, { textAlign: 'center' }]}>{t('hl.lastSync', { t: lastSync })}</Text>}
          {ready && (
            <>
              <Button title={busy === 'sync' ? t('hl.syncing') : t('hl.sync')} icon="sync" onPress={() => sync(false)} loading={busy === 'sync'} />
              <Button
                title={t('hl.exportToday', { app: appName })}
                icon="barbell-outline"
                variant="secondary"
                size="md"
                onPress={() => sync(true)}
                loading={busy === 'today'}
              />
            </>
          )}
          <Button title={t('hl.disconnect')} icon="unlink" variant="danger" size="md" onPress={disconnect} loading={busy === 'off'} />
          <Text style={[type.small, { textAlign: 'center', fontSize: 12 }]}>{t('hl.disconnectHint', { app: appName })}</Text>
        </Animated.View>
      )}
    </Screen>
  );
}

/** "traditionalStrengthTraining" / "strength_training" -> "Traditional strength training" */
function prettyType(raw?: string) {
  if (!raw) return '—';
  const words = raw.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function Row({ icon, title, text }: { icon: 'download-outline' | 'push-outline' | 'lock-closed-outline'; title: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: space(3) }}>
      <Ionicons name={icon} size={20} color={colors.accent} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text style={type.h3}>{title}</Text> : null}
        <Text style={[type.small, { color: title ? colors.muted : colors.text }]}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  heart: { width: 40, height: 40, borderRadius: 12, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space(2.5),
    paddingVertical: space(1),
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  stats: { flexDirection: 'row', gap: space(3) },
  stat: { flex: 1, gap: space(1) },
  workout: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2.5) },
  workoutIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,90,110,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
