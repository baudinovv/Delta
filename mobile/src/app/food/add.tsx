import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { ManualSheet, mealForNow, ScanSheet } from '@/components/food-sheets';
import { FoodRow } from '@/components/food-row';
import { SearchBar, SearchResults } from '@/components/food-search';
import { PressScale } from '@/components/motion';
import { Button, IconButton, Loading, Segmented, type IconName } from '@/components/ui';
import { api, type Food, type Meal, type RecentFood } from '@/lib/api';
import { portionText } from '@/lib/food';
import { errorText, useI18n } from '@/lib/i18n';
import { getMealPhoto, isoDate, PermissionDenied, type Photo } from '@/lib/photo';
import { useToken } from '@/lib/session';
import { colors, radius, space, type, webFrame } from '@/lib/theme';

type Tab = 'recent' | 'favorites' | 'mine';

/** FatSecret-style "add food": search, barcode, photo, quick add; recent / favorites / my foods. */
export default function AddFoodScreen() {
  const token = useToken();
  const { t, lang } = useI18n();
  const params = useLocalSearchParams<{ meal?: Meal; date?: string }>();
  const meal: Meal = params.meal ?? mealForNow();
  const date = params.date ?? isoDate(new Date());

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('recent');
  const [recent, setRecent] = useState<RecentFood[] | null>(null);
  const [favorites, setFavorites] = useState<Food[] | null>(null);
  const [mine, setMine] = useState<Food[] | null>(null);
  const [added, setAdded] = useState(0);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [manual, setManual] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api.recentFoods(token, lang).then(setRecent).catch(() => setRecent([]));
      api.favoriteFoods(token, lang).then(setFavorites).catch(() => setFavorites([]));
      api.myFoods(token, lang).then(setMine).catch(() => setMine([]));
    }, [token, lang]),
  );

  const log = async (food: Food, grams: number, servingLabel?: string, servingsCount?: number) => {
    if (!food.id) return;
    await api.addFood(token, { date, meal, lang, items: [{ foodId: food.id, grams: Math.round(grams), servingLabel, servingsCount }] });
    setAdded((n) => n + 1);
  };

  const open = (food: Food) =>
    router.push({
      pathname: '/food/item',
      params: food.id ? { id: food.id, meal, date } : { barcode: food.barcode!, meal, date },
    });

  const snap = async () => {
    try {
      const p = await getMealPhoto('camera');
      if (p) setPhoto(p);
    } catch (e) {
      const msg = e instanceof PermissionDenied ? t('food.permission') : t('err.generic');
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert(msg);
    }
  };

  const actions: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'barcode-outline', label: t('food.scanBarcode'), onPress: () => router.push({ pathname: '/food/scan', params: { meal, date } }) },
    { icon: 'camera-outline', label: t('food.photoMeal'), onPress: snap },
    { icon: 'flash-outline', label: t('fs.quick'), onPress: () => setManual(true) },
    { icon: 'create-outline', label: t('fs.newFood'), onPress: () => router.push('/food/new') },
    { icon: 'restaurant-outline', label: t('fs.newRecipe'), onPress: () => router.push('/food/recipe') },
  ];

  const list = tab === 'recent' ? recent : tab === 'favorites' ? favorites : mine;
  const empty = tab === 'recent' ? t('fs.emptyRecent') : tab === 'favorites' ? t('fs.emptyFav') : t('fs.emptyMine');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: t(`food.meal.${meal}`) }} />
      <ScrollView contentContainerStyle={[styles.content, webFrame]} keyboardShouldPersistTaps="handled">
        <SearchBar
          value={query}
          onChange={setQuery}
          right={
            <IconButton
              icon="barcode-outline"
              label={t('food.scanBarcode')}
              size={48}
              onPress={() => router.push({ pathname: '/food/scan', params: { meal, date } })}
            />
          }
        />

        {query.trim().length >= 2 ? (
          <SearchResults
            query={query}
            onOpen={open}
            onQuickAdd={(f, p) => log(f, p.grams, p.label, 1)}
            emptyAction={
              <Button
                title={t('fs.newFood')}
                icon="add"
                variant="secondary"
                size="md"
                onPress={() => router.push({ pathname: '/food/new', params: { name: query.trim() } })}
              />
            }
          />
        ) : (
          <Animated.View entering={FadeIn} style={{ gap: space(3) }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(2) }}>
              {actions.map((a) => (
                <PressScale key={a.label} onPress={a.onPress} hapticKind="tap" scaleTo={0.94} style={styles.action}>
                  <Ionicons name={a.icon} size={22} color={colors.accent} />
                  <Text style={[type.small, { color: colors.text, fontWeight: '600', fontSize: 13 }]}>{a.label}</Text>
                </PressScale>
              ))}
            </ScrollView>

            <Segmented<Tab>
              options={[
                { value: 'recent', label: t('fs.recent') },
                { value: 'favorites', label: t('fs.favorites') },
                { value: 'mine', label: t('fs.mine') },
              ]}
              value={tab}
              onChange={setTab}
            />

            {list == null ? (
              <Loading compact />
            ) : list.length === 0 ? (
              <Animated.View entering={FadeIn} style={styles.empty}>
                <Ionicons
                  name={tab === 'recent' ? 'time-outline' : tab === 'favorites' ? 'star-outline' : 'create-outline'}
                  size={30}
                  color={colors.faint}
                />
                <Text style={[type.small, { textAlign: 'center' }]}>{empty}</Text>
              </Animated.View>
            ) : tab === 'recent' ? (
              (list as RecentFood[]).map((r, i) => (
                <FoodRow
                  key={`${tab}-${r.food.id}`}
                  food={r.food}
                  index={i}
                  portion={
                    r.grams
                      ? { label: portionText(r.servingLabel, r.servingsCount, r.grams, lang), grams: r.grams }
                      : undefined
                  }
                  onOpen={() => open(r.food)}
                  onQuickAdd={(p) => log(r.food, p.grams, r.servingLabel, r.servingsCount)}
                />
              ))
            ) : (
              (list as Food[]).map((f, i) => (
                <FoodRow
                  key={`${tab}-${f.id}`}
                  food={f}
                  index={i}
                  onOpen={() => open(f)}
                  onQuickAdd={(p) => log(f, p.grams, p.label, 1)}
                />
              ))
            )}
          </Animated.View>
        )}
      </ScrollView>

      {added > 0 && (
        <Animated.View entering={SlideInDown.springify().damping(16)} exiting={SlideOutDown} style={styles.addedBar}>
          <View style={styles.addedBadge}>
            <Ionicons name="checkmark" size={16} color={colors.accentInk} />
          </View>
          <Text style={[type.h3, { flex: 1 }]}>{t('fs.added', { n: added })}</Text>
          <Button title={t('fs.done')} size="md" onPress={() => router.back()} />
        </Animated.View>
      )}

      <ScanSheet
        photo={photo}
        date={date}
        initialMeal={meal}
        onClose={() => setPhoto(null)}
        onSaved={() => {
          setPhoto(null);
          router.back();
        }}
      />
      <ManualSheet
        visible={manual}
        date={date}
        initialMeal={meal}
        onClose={() => setManual(false)}
        onSaved={() => {
          setManual(false);
          setAdded((n) => n + 1);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space(4), paddingBottom: space(28), gap: space(3) },
  action: {
    width: 92,
    paddingVertical: space(3),
    alignItems: 'center',
    gap: space(1.5),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  empty: { alignItems: 'center', gap: space(3), paddingVertical: space(8), paddingHorizontal: space(6) },
  addedBar: {
    position: 'absolute',
    left: space(4),
    right: space(4),
    bottom: space(6),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(3),
    paddingLeft: space(4),
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  addedBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
