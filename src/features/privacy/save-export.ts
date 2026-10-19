import { Share } from 'react-native';

/** Opens the share sheet with the export so the user can save it to Files, email it, etc. */
export async function saveExport(json: string, fileName: string): Promise<void> {
  await Share.share({ title: fileName, message: json });
}
