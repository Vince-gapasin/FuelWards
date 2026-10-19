import { Image } from 'expo-image';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

const source = require('@/assets/images/logo.png');

/**
 * The logo image has a white background, so it sits on a white rounded tile. In light mode the
 * tile blends in; in dark mode it reads like an app icon.
 */
export function Logo({ size = 200 }: { size?: number }) {
  const { t } = useTranslation();
  return (
    <View className="overflow-hidden bg-white" style={{ borderRadius: size * 0.18 }}>
      <Image
        source={source}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessibilityLabel={t('common.logo')}
      />
    </View>
  );
}
