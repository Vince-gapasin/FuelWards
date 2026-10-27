import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

import type { PushStatus } from './push-types';

// Show alerts as banners even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/** Current push state without prompting. */
export async function getPushStatus(): Promise<PushStatus> {
  if (!Device.isDevice) return 'unsupported';
  if (!projectId()) return 'not-configured';
  const { granted } = await Notifications.getPermissionsAsync();
  return granted ? 'on' : 'off';
}

/** Asks for permission, then registers this device's Expo push token for the signed-in user. */
export async function enablePush(): Promise<PushStatus> {
  if (!Device.isDevice) return 'unsupported';
  const id = projectId();
  if (!id) return 'not-configured';

  if (Platform.OS === 'android') {
    // Android 13+ only shows the permission prompt once a channel exists.
    await Notifications.setNotificationChannelAsync('price-alerts', {
      name: 'Price alerts',
      // eslint-disable-next-line import/namespace -- re-exported via `export *`, which the rule can't follow
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const { granted } = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!granted) return 'denied';

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ token, platform: Platform.OS, updated_at: new Date().toISOString() });
  if (error) throw error;
  return 'on';
}

/** Opens the station when the user taps an alert notification. */
export function useAlertNotificationTaps() {
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data;
      if (typeof data?.stationId === 'string') router.push(`/station/${data.stationId}`);
      else if (data?.kind === 'doe' || data?.kind === 'weekly') router.push('/');
    };
    Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
