import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';

type Props = { tone: 'success' | 'error' | 'info'; message: string };

const styles = {
  success: {
    box: 'bg-brand/10 border-brand/40',
    text: 'text-ink',
    icon: 'checkmark-circle',
    color: '#00BF63',
  },
  error: {
    box: 'bg-danger/10 border-danger/40',
    text: 'text-ink',
    icon: 'alert-circle',
    color: '#BB0000',
  },
  info: {
    box: 'bg-sky border-action/30',
    text: 'text-ink',
    icon: 'information-circle',
    color: '#0066D6',
  },
} as const;

/** Inline banner for form results ("Account created", "Wrong password", …). */
export function Notice({ tone, message }: Props) {
  const s = styles[tone];
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      className={`flex-row items-start gap-2 rounded-lg border px-3 py-2.5 ${s.box}`}>
      <Ionicons name={s.icon} size={18} color={s.color} />
      <Text className={`flex-1 text-sm ${s.text}`}>{message}</Text>
    </View>
  );
}
