import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Shared "how do you want to add a photo" flow — a camera-or-library choice
 * used by both the listing photo picker (multiple photos) and the profile
 * avatar picker (a single photo). Kept in one place so the permission
 * handling and the choice UI stay consistent across both.
 */

async function requestCameraPermission(): Promise<boolean> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Camera access needed', 'Allow ParkNext to use your camera to take a photo.');
    return false;
  }
  return true;
}

async function requestLibraryPermission(): Promise<boolean> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Photo access needed', 'Allow ParkNext to access your photo library to add a photo.');
    return false;
  }
  return true;
}

/** Opens the camera and returns a single captured photo's URI, or `null` if cancelled/denied. */
export async function takePhotoWithCamera(): Promise<string | null> {
  if (!(await requestCameraPermission())) return null;
  const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

/** Opens the photo library and returns up to `limit` selected URIs, or `null` if cancelled/denied. */
export async function pickPhotosFromLibrary(limit: number): Promise<string[] | null> {
  if (limit <= 0) return null;
  if (!(await requestLibraryPermission())) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: limit > 1,
    selectionLimit: limit,
    quality: 0.8,
  });
  if (result.canceled) return null;
  return result.assets.map((asset) => asset.uri);
}

/** Opens the photo library and returns a single selected URI, or `null` if cancelled/denied. */
export async function pickSinglePhotoFromLibrary(): Promise<string | null> {
  const uris = await pickPhotosFromLibrary(1);
  return uris && uris.length > 0 ? uris[0] : null;
}

/**
 * Presents the "Take Photo" / "Choose from Library" / "Cancel" action sheet
 * and resolves with whatever the chosen path returns (`null` on Cancel or if
 * the chosen path itself is cancelled/denied).
 */
export function choosePhotoSource(options: {
  onTakePhoto: () => void;
  onChooseLibrary: () => void;
  title?: string;
}): void {
  Alert.alert(options.title ?? 'Add a photo', undefined, [
    { text: 'Take Photo', onPress: options.onTakePhoto },
    { text: 'Choose from Library', onPress: options.onChooseLibrary },
    { text: 'Cancel', style: 'cancel' },
  ]);
}