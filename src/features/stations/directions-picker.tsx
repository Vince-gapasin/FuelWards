import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useThemeVars } from '@/theme/theme';

import { directionsUrl, wazeUrl } from './format';
import type { LatLng } from './types';

type Props = { target: LatLng | null; onClose: () => void };

/** Choose Google Maps or Waze for directions. Shown while `target` is set. */
export function DirectionsPicker({ target, onClose }: Props) {
  const { t } = useTranslation();
  const themeVars = useThemeVars();
  const open = (url: string) => {
    onClose();
    Linking.openURL(url);
  };
  return (
    <Modal visible={target != null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[{ flex: 1 }, themeVars]} className="justify-end p-4">
        {/* The dimmed backdrop closes the picker. It sits behind the sheet, not around it, so
            buttons are never nested. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          className="absolute inset-0 bg-black/50"
        />
        <View className="w-full max-w-md gap-2 self-center rounded-2xl bg-surface p-4">
          <Text accessibilityRole="header" className="pb-1 font-bold text-lg text-ink">
            {t('directions.title')}
          </Text>
          {target ? (
            <>
              <Option icon="map" label="Google Maps" onPress={() => open(directionsUrl(target))} />
              <Option icon="navigate" label="Waze" onPress={() => open(wazeUrl(target))} />
            </>
          ) : null}
          <Option icon="close" label={t('common.cancel')} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function Option({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-12 flex-row items-center gap-3 rounded-xl border border-line px-4 active:bg-sky">
      <Ionicons name={icon} size={20} className="text-emphasis" />
      <Text className="font-semibold text-base text-ink">{label}</Text>
    </Pressable>
  );
}
