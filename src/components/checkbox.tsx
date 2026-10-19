import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  error?: string;
};

export function Checkbox({ checked, onChange, label, error }: Props) {
  return (
    <View className="gap-1">
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => onChange(!checked)}
        hitSlop={6}
        className="flex-row items-center gap-2.5 self-start py-1">
        <View
          className={`h-5 w-5 items-center justify-center rounded border ${
            checked ? 'border-action bg-action' : error ? 'border-danger' : 'border-line-strong'
          }`}>
          {checked ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
        </View>
        {typeof label === 'string' ? <Text className="text-sm text-ink">{label}</Text> : label}
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" className="text-sm text-danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
