import { Pressable, Text, View } from 'react-native';

type Props<T extends string> = {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
};

/** A row of mutually exclusive choices ("System / Light / Dark"). */
export function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} className="gap-2">
      <Text className="font-semibold text-sm text-ink">{label}</Text>
      <View className="flex-row rounded-xl bg-sky p-1">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              aria-checked={active}
              onPress={() => onChange(option.value)}
              className={`h-9 flex-1 items-center justify-center rounded-lg ${active ? 'bg-surface shadow-sm' : ''}`}>
              <Text className={`text-sm ${active ? 'font-semibold text-ink' : 'text-ink-muted'}`}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
