import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { haptic } from '@/components/motion';
import { Button, ErrorText, IconButton } from '@/components/ui';
import { api, ApiError, type Meal } from '@/lib/api';
import { errorText, useI18n } from '@/lib/i18n';
import { useToken } from '@/lib/session';
import { colors, radius, space, type } from '@/lib/theme';

const FRAME_W = 280;
const FRAME_H = 170;

/** Barcode scanner: finds the product in the catalog or Open Food Facts and opens it. */
export default function ScanScreen() {
  const token = useToken();
  const { t, lang } = useI18n();
  const params = useLocalSearchParams<{ meal?: Meal; date?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const handled = useRef(false);

  const lookup = async (raw: string) => {
    const code = raw.replace(/\D/g, '');
    if (handled.current || code.length < 8) return;
    handled.current = true;
    haptic('success');
    setBusy(true);
    setError(null);
    try {
      const food = await api.foodByBarcode(token, code, lang);
      router.replace({ pathname: '/food/item', params: { id: food.id!, meal: params.meal ?? '', date: params.date ?? '' } });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'BARCODE_NOT_FOUND') {
        haptic('warn');
        setNotFound(code);
      } else {
        setError(errorText(e, t));
        handled.current = false;
      }
      setBusy(false);
    }
  };

  const onScanned = (r: BarcodeScanningResult) => lookup(r.data);

  const again = () => {
    setNotFound(null);
    handled.current = false;
  };

  const cameraReady = permission?.granted && !notFound;

  return (
    <View style={styles.screen}>
      {cameraReady && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={busy ? undefined : onScanned}
        />
      )}
      <View style={[StyleSheet.absoluteFill, styles.shade]} pointerEvents="none" />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.top}>
            <IconButton icon="close" label="close" onPress={() => router.back()} />
          </View>

          <View style={styles.center}>
            {notFound ? (
              <Animated.View entering={FadeInDown.springify()} style={styles.card}>
                <Ionicons name="help-circle" size={36} color={colors.warn} />
                <Text style={[type.h3, { textAlign: 'center' }]}>{t('scan.notFound')}</Text>
                <Text style={[type.small, type.num]}>{notFound}</Text>
                <Button
                  title={t('scan.create')}
                  icon="add"
                  onPress={() => router.replace({ pathname: '/food/new', params: { barcode: notFound } })}
                  style={{ alignSelf: 'stretch' }}
                />
                <Button title={t('scan.again')} variant="ghost" size="md" onPress={again} />
              </Animated.View>
            ) : permission && !permission.granted ? (
              <Animated.View entering={FadeIn} style={styles.card}>
                <Ionicons name="camera-outline" size={36} color={colors.accent} />
                <Text style={[type.body, { textAlign: 'center' }]}>{t('scan.permission')}</Text>
                <Button title={t('scan.allow')} onPress={requestPermission} style={{ alignSelf: 'stretch' }} />
              </Animated.View>
            ) : (
              <>
                <Frame busy={busy} />
                <Text style={styles.hint}>{busy ? t('scan.searching') : t('scan.hint')}</Text>
              </>
            )}
          </View>

          <View style={styles.bottom}>
            <ErrorText message={error} />
            <Text style={[type.small, { color: colors.text }]}>{t('scan.manual')}</Text>
            <View style={{ flexDirection: 'row', gap: space(2) }}>
              <TextInput
                value={manual}
                onChangeText={setManual}
                keyboardType="number-pad"
                placeholder="4870000000000"
                placeholderTextColor={colors.faint}
                maxLength={14}
                style={styles.input}
                onSubmitEditing={() => lookup(manual)}
              />
              <Button
                title={t('scan.find')}
                size="md"
                onPress={() => {
                  handled.current = false;
                  lookup(manual);
                }}
                disabled={manual.replace(/\D/g, '').length < 8 || busy}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/** Viewfinder with corner marks and a sweeping laser line. */
function Frame({ busy }: { busy: boolean }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withTiming(FRAME_H - 6, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [y]);
  const line = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const c = busy ? colors.accent : '#fff';
  return (
    <View style={{ width: FRAME_W, height: FRAME_H }}>
      {[
        { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
        { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
        { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
        { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
      ].map((s, i) => (
        <View key={i} style={[styles.corner, s, { borderColor: c }]} />
      ))}
      <Animated.View style={[styles.laser, line]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  shade: { backgroundColor: 'rgba(0,0,0,0.35)' },
  top: { flexDirection: 'row', justifyContent: 'flex-end', padding: space(4) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space(5), paddingHorizontal: space(5) },
  hint: { ...type.body, color: '#fff', textAlign: 'center', fontWeight: '600' },
  card: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space(5),
  },
  bottom: {
    gap: space(2),
    padding: space(4),
    margin: space(4),
    borderRadius: radius.lg,
    backgroundColor: 'rgba(20,23,28,0.92)',
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
    paddingHorizontal: space(3),
    letterSpacing: 1,
  },
  corner: { position: 'absolute', width: 36, height: 36 },
  laser: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 3,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 1,
    shadowRadius: 8,
  },
});
