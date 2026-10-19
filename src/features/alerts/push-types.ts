/**
 * unsupported: web or a simulator; not-configured: the app has no EAS project ID yet;
 * off: not asked yet; denied: the user said no; on: this device receives alerts.
 */
export type PushStatus = 'unsupported' | 'not-configured' | 'off' | 'denied' | 'on';
