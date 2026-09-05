import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Shared photo picking — used by the listing photo picker (multiple photos)
 * and the profile avatar picker (a single photo). Kept in one place so both
 * behave identically.
 *
 * Which source to use is chosen in `PhotoSourceSheet`, not here. Android
 * can't be made to show Camera in its own "Open with" sheet without native
 * code: camera apps don't register an ACTION_GET_CONTENT filter, so the only
 * way to get a Camera entry there is `EXTRA_INITIAL_INTENTS`, which
 * expo-image-picker doesn't expose.
 */

/** Opens the camera and returns a single captured photo's URI, or `null` if cancelled/denied. */
export async function takePhotoWithCamera(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Camera access needed', 'Allow ParkNext to use your camera to take a photo.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

/**
 * Opens the photo library and returns up to `limit` selected URIs, or `null`
 * if cancelled.
 *
 * No permission request in front of this on purpose: `launchImageLibraryAsync`
 * does no permission check at all on Android (see `ImagePickerModule`), and
 * iOS's PHPicker needs none either — asking first only added a prompt that
 * changed nothing.
 */
export async function pickPhotosFromLibrary(limit: number): Promise<string[] | null> {
  if (limit <= 0) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 0.8,
  });
  if (result.canceled) return null;
  return result.assets.map((asset) => asset.uri);
}

/** Opens the photo library and returns a single selected URI, or `null` if cancelled. */
export async function pickSinglePhotoFromLibrary(): Promise<string | null> {
  const uris = await pickPhotosFromLibrary(1);
  return uris && uris.length > 0 ? uris[0] : null;
}
