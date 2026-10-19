import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { buildChart, type PricePoint } from './chart';
import { formatPrice } from './format';
import { useThemeColors } from '@/theme/theme';

const HEIGHT = 160;

/** 30-day price line for one fuel. */
export function PriceChart({
  points,
  color = '#0066D6',
}: {
  points: PricePoint[];
  color?: string;
}) {
  const theme = useThemeColors();
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const chart = buildChart(points, width, HEIGHT, { top: 14, right: 14, bottom: 14, left: 14 });
  const last = chart.dots.at(-1);
  const firstDot = chart.dots[0];

  if (!points.length) {
    return (
      <View className="h-40 items-center justify-center rounded-2xl bg-sky/60">
        <Text className="px-6 text-center text-sm text-ink-muted">{t('chart.empty')}</Text>
      </View>
    );
  }

  const change = last && firstDot ? last.price - firstDot.price : 0;
  const prices = points.map((p) => p.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return (
    <View className="gap-2">
      <View className="flex-row items-end justify-between">
        <Text className="font-black text-2xl text-ink">{formatPrice(last?.price)}</Text>
        {points.length > 1 ? (
          <Text
            className={`font-semibold text-sm ${change > 0 ? 'text-critical' : change < 0 ? 'text-positive' : 'text-ink-muted'}`}>
            {change === 0
              ? t('chart.noChange')
              : t('chart.change', {
                  arrow: change > 0 ? '▲' : '▼',
                  amount: formatPrice(Math.abs(change)),
                })}
          </Text>
        ) : null}
      </View>
      <View
        onLayout={onLayout}
        accessibilityLabel={t('chart.label', { low: formatPrice(low), high: formatPrice(high) })}
        className="rounded-2xl bg-sky/60"
        style={{ height: HEIGHT }}>
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            <Line
              x1={14}
              x2={width - 14}
              y1={14}
              y2={14}
              stroke={theme.line}
              strokeDasharray="4 4"
            />
            <Line
              x1={14}
              x2={width - 14}
              y1={HEIGHT - 14}
              y2={HEIGHT - 14}
              stroke={theme.line}
              strokeDasharray="4 4"
            />
            <Path
              d={chart.path}
              stroke={color}
              strokeWidth={2.5}
              fill="none"
              strokeLinejoin="round"
            />
            {chart.dots.map((d) => (
              <Circle
                key={d.day}
                cx={d.x}
                cy={d.y}
                r={3.5}
                fill={theme.surface}
                stroke={color}
                strokeWidth={2}
              />
            ))}
          </Svg>
        ) : null}
      </View>
      <View className="flex-row justify-between">
        <Text className="text-xs text-ink-muted">
          {t('chart.high', { price: formatPrice(high) })}
        </Text>
        <Text className="text-xs text-ink-muted">
          {t('chart.low', { price: formatPrice(low) })}
        </Text>
      </View>
    </View>
  );
}
