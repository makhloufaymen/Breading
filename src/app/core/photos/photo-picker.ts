import { Injectable } from '@angular/core';
import { Camera, CameraErrorCode, type MediaResult, MediaTypeSelection } from '@capacitor/camera';

import { resizeToJpeg } from './image-processing';

const CANCEL_CODES: readonly string[] = [CameraErrorCode.TakePhotoCancelled, CameraErrorCode.ChooseMediaCancelled];

/** True when the user simply closed the camera or the gallery. */
export function isPickCancelled(error: unknown): boolean {
  const { code, message } = (error ?? {}) as { code?: string; message?: string };
  return (!!code && CANCEL_CODES.includes(code)) || /cancel/i.test(message ?? '');
}

/**
 * Camera and gallery through @capacitor/camera: native screens on Android/iOS,
 * a file input in the browser. Returns photos ready to upload (resized JPEG, no EXIF).
 */
@Injectable({ providedIn: 'root' })
export class PhotoPicker {
  async takePhoto(): Promise<Blob> {
    const media = await Camera.takePhoto({ quality: 90, correctOrientation: true, webUseInput: true });
    return this.prepare(media);
  }

  async chooseFromGallery(limit: number): Promise<Blob[]> {
    const { results } = await Camera.chooseFromGallery({
      mediaType: MediaTypeSelection.Photo,
      allowMultipleSelection: limit > 1,
      limit,
      quality: 90,
      correctOrientation: true,
      webUseInput: true,
    });
    // The limit is not enforced everywhere (browser, Android < 13).
    return Promise.all(results.slice(0, limit).map((media) => this.prepare(media)));
  }

  private async prepare(media: MediaResult): Promise<Blob> {
    if (!media.webPath) throw new Error('No image returned');
    // webPath is a URL the WebView can fetch (blob: in the browser, a local file URL on mobile).
    const original = await (await fetch(media.webPath)).blob();
    return resizeToJpeg(original);
  }
}
