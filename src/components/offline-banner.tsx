import Ionicons from '@expo/vector-icons/Ionicons';
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export function useIsOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}

/** Shown while there's no connection; saved prices stay visible underneath. */
export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useIsOnline();
  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      className="mx-3 flex-row items-center gap-2 rounded-xl bg-navy px-3 py-2.5">
      <Ionicons name="cloud-offline-outline" size={18} color="#FFFFFF" />
      <Text className="flex-1 text-sm text-white">{t('home.offline')}</Text>
    </View>
  );
}
