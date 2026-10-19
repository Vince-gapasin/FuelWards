import { supabase } from '@/lib/supabase';

/** Everything FuelWards holds about the signed-in user, as pretty-printed JSON. */
export async function exportMyData(): Promise<string> {
  const { data, error } = await supabase.rpc('my_data_export');
  if (error) throw error;
  return JSON.stringify(data, null, 2);
}

/**
 * Deletes the account on the server, then forgets the session on this device. The server keeps
 * confirmed prices without the user's name (see the admin_privacy migration).
 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  // The user no longer exists, so a server-side sign-out would fail; just drop the local session.
  await supabase.auth.signOut({ scope: 'local' });
}

export const exportFileName = (username: string) =>
  `fuelwards-${username}-${new Date().toISOString().slice(0, 10)}.json`;
