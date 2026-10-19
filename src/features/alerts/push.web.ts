import type { PushStatus } from './push-types';

// Web version: push notifications are phone-only for now. Matches still appear in the in-app inbox.
export async function getPushStatus(): Promise<PushStatus> {
  return 'unsupported';
}

export async function enablePush(): Promise<PushStatus> {
  return 'unsupported';
}

export function useAlertNotificationTaps() {}
