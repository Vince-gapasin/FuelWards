import { ActivityIndicator, Pressable, Text } from 'react-native';

import { useThemeColors } from '@/theme/theme';
type Variant = 'primary' | 'secondary' | 'outline' | 'danger';

const containers: Record<Variant, string> = {
  primary: 'bg-action active:bg-navy-600',
  secondary: 'bg-brand active:bg-brand-light',
  outline: 'border border-line-strong bg-surface active:bg-sky',
  danger: 'bg-danger active:opacity-80',
};

const labels: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-navy',
  outline: 'text-ink',
  danger: 'text-white',
};

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  className,
}: Props) {
  const theme = useThemeColors();
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      aria-disabled={inactive}
      aria-busy={loading}
      onPress={onPress}
      disabled={inactive}
      className={`h-12 flex-row items-center justify-center rounded-xl px-6 ${containers[variant]} ${inactive ? 'opacity-50' : ''} ${className ?? ''}`}>
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? theme.ink : '#FFFFFF'} />
      ) : (
        <Text className={`font-semibold text-base ${labels[variant]}`}>{label}</Text>
      )}
    </Pressable>
  );
}
