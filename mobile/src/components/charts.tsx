import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTween } from '@/components/motion';
import { colors, radius, space, type } from '@/lib/theme';

/** Circular progress that fills smoothly. Turns red-ish past 105% so "over target" is visible. */
export function Ring({
  value,
  max,
  size = 168,
  stroke = 14,
  color = colors.accent,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = max > 0 ? value / max : 0;
  const shown = useTween(Math.min(1, ratio), 900);
  const over = ratio > 1.05;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface3} strokeWidth={stroke} fill="none" />
        {shown > 0.002 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={over ? colors.down : color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * shown} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{children}</View>
    </View>
  );
}

export function MacroBar({
  label,
  value,
  target,
  color,
  unit,
}: {
  label: string;
  value: number;
  target?: number | null;
  color: string;
  unit: string;
}) {
  const pct = target ? Math.min(1, value / target) : 0;
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(pct, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [pct, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  const shownValue = useTween(value);

  return (
    <View style={{ gap: space(1.5) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={[type.small, { color: colors.text, fontWeight: '600' }]}>{label}</Text>
        <Text style={[type.small, type.num]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{Math.round(shownValue)}</Text>
          {target ? ` / ${target}` : ''} {unit}
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: color }, fill]} />
      </View>
    </View>
  );
}

/** Seven-day bars that grow in one after another, with an optional dashed target line. Today is highlighted. */
export function BarChart({
  values,
  labels,
  target,
  height = 120,
  color = colors.accent,
  format = (n: number) => String(Math.round(n)),
}: {
  values: number[];
  labels: string[];
  target?: number | null;
  height?: number;
  color?: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, target ?? 0, ...values) * 1.08;
  const n = values.length;
  const targetY = target ? height - (target / max) * height : null;

  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: space(2) }}>
        {values.map((v, i) => (
          <Bar
            key={i}
            ratio={v > 0 ? Math.max(0.025, v / max) : 0}
            height={height}
            color={v > 0 ? color : colors.surface3}
            dim={v > 0 && i !== n - 1}
            delay={i * 45}
          />
        ))}
        {targetY != null && (
          <Animated.View entering={FadeIn.delay(500)} style={[styles.targetLine, { top: targetY }]} pointerEvents="none" />
        )}
      </View>
      <View style={{ flexDirection: 'row', marginTop: space(2), gap: space(2) }}>
        {labels.map((l, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[styles.barLabel, i === n - 1 && { color: colors.text }]}>{l}</Text>
            <Text style={[styles.barValue, i === n - 1 && { color: colors.text }]}>
              {values[i] > 0 ? format(values[i]) : '–'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Bar({
  ratio,
  height,
  color,
  dim,
  delay,
}: {
  ratio: number;
  height: number;
  color: string;
  dim: boolean;
  delay: number;
}) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withDelay(delay, withSpring(ratio, { damping: 16, stiffness: 140 }));
  }, [ratio, delay, h]);
  const animated = useAnimatedStyle(() => ({ height: Math.max(3, h.value * height) }));
  return <Animated.View style={[styles.bar, { backgroundColor: color, opacity: dim ? 0.55 : 1 }, animated]} />;
}

/** Small trend line; nulls (weeks without that exercise) are skipped. Fades in. */
export function Sparkline({
  values,
  width = 96,
  height = 36,
  color = colors.accent,
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const pts = values
    .map((v, i) => (v == null ? null : { i, v }))
    .filter((p): p is { i: number; v: number } => p != null);
  if (pts.length === 0) return <View style={{ width, height }} />;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  const pad = 4;
  const x = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2);
  const y = (v: number) => (max === min ? height / 2 : pad + (1 - (v - min) / span) * (height - pad * 2));
  const d = pts.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <Animated.View entering={FadeIn.duration(600).delay(200)}>
      <Svg width={width} height={height}>
        {pts.length > 1 && <Path d={d} stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round" />}
        <Circle cx={x(last.i)} cy={y(last.v)} r={3.5} fill={color} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surface3, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill },
  bar: { flex: 1, borderRadius: 7 },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(243,245,248,0.4)',
  },
  barLabel: { fontSize: 11, fontWeight: '600', color: colors.muted },
  barValue: { fontSize: 10, color: colors.faint, marginTop: 2, fontVariant: ['tabular-nums'] },
});
