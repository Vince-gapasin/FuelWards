import { Image } from 'expo-image';

const source = require('@/assets/images/logo.png');

export function Logo({ size = 200 }: { size?: number }) {
  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityLabel="Fuel Rewards logo"
    />
  );
}
