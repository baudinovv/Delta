import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type Photo = { uri: string; base64: string };

export class PermissionDenied extends Error {}

/**
 * Takes or picks a photo and shrinks it to ~1024px JPEG, which is plenty for food recognition
 * and keeps the upload around 100-200 KB. Returns null if the user cancels.
 */
export async function getMealPhoto(source: 'camera' | 'gallery'): Promise<Photo | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new PermissionDenied();
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const ctx = ImageManipulator.manipulate(asset.uri);
  if ((asset.width ?? 0) > 1024 || (asset.height ?? 0) > 1024) {
    ctx.resize((asset.width ?? 0) >= (asset.height ?? 0) ? { width: 1024 } : { height: 1024 });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  if (!saved.base64) return null;
  return { uri: saved.uri, base64: saved.base64 };
}

export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
