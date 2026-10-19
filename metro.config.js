const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');

// Sentry's config is Expo's default plus debug IDs that match crash reports to source maps.
const config = getSentryExpoConfig(__dirname);

module.exports = withNativeWind(config, { input: './src/global.css' });
