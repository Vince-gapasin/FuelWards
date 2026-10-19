import { ActivityIndicator, Pressable, Text } from 'react-native';

type Variant = 'primary' | 'secondary' | 'outline';

const containers: Record<Variant, string> = {
  primary: 'bg-action active:bg-navy-600',
  secondary: 'bg-brand active:bg-brand-light',
  outline: 'border border-line-strong bg-white active:bg-sky',
};

const labels: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-white',
  outline: 'text-ink',
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
        <ActivityIndicator color={variant === 'outline' ? '#1D1B20' : '#FFFFFF'} />
      ) : (
        <Text className={`font-semibold text-base ${labels[variant]}`}>{label}</Text>
      )}
    </Pressable>
  );
}
