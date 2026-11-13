import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { colors, radius, space, type } from '@/lib/theme';

/** Circular progress. Goes red-ish past 100% so "over target" is visible. */
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
  const shown = Math.min(1, ratio);
  const over = ratio > 1.05;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface3} strokeWidth={stroke} fill="none" />
        {shown > 0 && (
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
  return (
    <View style={{ gap: space(1.5) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={[type.small, { color: colors.text, fontWeight: '600' }]}>{label}</Text>
        <Text style={[type.small, type.num]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{Math.round(value)}</Text>
          {target ? ` / ${target}` : ''} {unit}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

/** Seven-day bars with an optional dashed target line. The last bar (today) is highlighted. */
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
  const w = 100;
  const gap = 3.2;
  const bw = (w - gap * (n - 1)) / n;
  const targetY = target ? height - (target / max) * height : null;

  return (
    <View>
      <View style={{ height }}>
        <Svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
          {values.map((v, i) => {
            const h = v > 0 ? Math.max(3, (v / max) * height) : 3;
            const x = i * (bw + gap);
            const today = i === n - 1;
            return (
              <Rect
                key={i}
                x={x}
                y={height - h}
                width={bw}
                height={h}
                rx={2.2}
                fill={v > 0 ? color : colors.surface3}
                opacity={v > 0 ? (today ? 1 : 0.55) : 1}
              />
            );
          })}
          {targetY != null && (
            <Line
              x1={0}
              x2={w}
              y1={targetY}
              y2={targetY}
              stroke={colors.text}
              strokeOpacity={0.45}
              strokeWidth={0.6}
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', marginTop: space(2) }}>
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

/** Small trend line; nulls (weeks without that exercise) are skipped. */
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
    <Svg width={width} height={height}>
      {pts.length > 1 && <Path d={d} stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round" />}
      <Circle cx={x(last.i)} cy={y(last.v)} r={3.5} fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surface3, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill },
  barLabel: { fontSize: 11, fontWeight: '600', color: colors.muted },
  barValue: { fontSize: 10, color: colors.faint, marginTop: 2, fontVariant: ['tabular-nums'] },
});
