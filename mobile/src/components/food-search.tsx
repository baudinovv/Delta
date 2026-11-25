import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { FoodRow } from '@/components/food-row';
import type { Food, Serving } from '@/lib/api';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useToken } from '@/lib/session';
import { colors, radius, space, type } from '@/lib/theme';

export function SearchBar({
  value,
  onChange,
  right,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  right?: React.ReactNode;
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  return (
    <View style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={t('fs.search')}
          placeholderTextColor={colors.faint}
          style={styles.searchInput}
          autoFocus={autoFocus}
          autoCorrect={false}
          returnKeyType="search"
        />
        {value.length > 0 && (
          <Pressable accessibilityLabel="clear" onPress={() => onChange('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={colors.faint} />
          </Pressable>
        )}
      </View>
      {right}
    </View>
  );
}

/**
 * Results for a query: the Delta catalog right away, packaged products from Open Food Facts once the
 * user pauses typing (that API is slower and rate-limited).
 */
export function SearchResults({
  query,
  onOpen,
  onQuickAdd,
  emptyAction,
}: {
  query: string;
  onOpen: (food: Food) => void;
  onQuickAdd?: (food: Food, portion: Serving) => Promise<void>;
  emptyAction?: React.ReactNode;
}) {
  const token = useToken();
  const { t, lang } = useI18n();
  const [local, setLocal] = useState<Food[] | null>(null);
  const [online, setOnline] = useState<Food[] | null>(null);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const my = ++seq.current;
    setOnline(null);
    if (q.length < 2) {
      setLocal(null);
      setLoadingOnline(false);
      return;
    }
    const localTimer = setTimeout(() => {
      api
        .searchFoods(token, q, lang)
        .then((r) => my === seq.current && setLocal(r.local))
        .catch(() => my === seq.current && setLocal([]));
    }, 150);
    let onlineTimer: ReturnType<typeof setTimeout> | undefined;
    if (q.length >= 3) {
      setLoadingOnline(true);
      onlineTimer = setTimeout(() => {
        api
          .searchFoods(token, q, lang, true)
          .then((r) => my === seq.current && setOnline(r.online ?? []))
          .catch(() => my === seq.current && setOnline([]))
          .finally(() => my === seq.current && setLoadingOnline(false));
      }, 600);
    } else {
      setLoadingOnline(false);
    }
    return () => {
      clearTimeout(localTimer);
      if (onlineTimer) clearTimeout(onlineTimer);
    };
  }, [query, token, lang]);

  if (local == null) {
    return <ActivityIndicator color={colors.accent} style={{ marginTop: space(6) }} />;
  }

  const nothing = local.length === 0 && !loadingOnline && (online?.length ?? 0) === 0;

  return (
    <View style={{ gap: space(2) }}>
      {local.length > 0 && <Text style={styles.section}>{t('fs.catalog')}</Text>}
      {local.map((f, i) => (
        <FoodRow
          key={f.id ?? f.barcode}
          food={f}
          index={i}
          onOpen={() => onOpen(f)}
          onQuickAdd={onQuickAdd ? (p) => onQuickAdd(f, p) : undefined}
        />
      ))}

      {(loadingOnline || (online?.length ?? 0) > 0) && <Text style={styles.section}>{t('fs.online')}</Text>}
      {loadingOnline && (
        <Animated.View entering={FadeIn} style={styles.loading}>
          <ActivityIndicator size="small" color={colors.muted} />
          <Text style={type.small}>{t('fs.onlineLoading')}</Text>
        </Animated.View>
      )}
      {online?.map((f, i) => (
        <FoodRow key={`off-${f.barcode}`} food={f} index={i} onOpen={() => onOpen(f)} />
      ))}

      {nothing && (
        <Animated.View entering={FadeIn} style={{ gap: space(3), alignItems: 'center', paddingVertical: space(6) }}>
          <Ionicons name="search-outline" size={32} color={colors.faint} />
          <Text style={[type.small, { textAlign: 'center' }]}>{t('fs.nothing')}</Text>
          {emptyAction}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: space(3),
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: space(3) },
  section: { ...type.caption, marginTop: space(2), marginLeft: space(1) },
  loading: { flexDirection: 'row', alignItems: 'center', gap: space(2), padding: space(3) },
});
