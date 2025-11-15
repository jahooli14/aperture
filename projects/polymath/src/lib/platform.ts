/**
 * Platform detection utilities for Capacitor
 * Determines if app is running on native (iOS/Android) or web
 */

import { Capacitor } from '@capacitor/core';

/**
 * Check if running on native platform (iOS or Android)
 */
export const isNative = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Check if running on Android
 */
export const isAndroid = (): boolean => {
  return Capacitor.getPlatform() === 'android';
};

/**
 * Check if running on iOS
 */
export const isIOS = (): boolean => {
  return Capacitor.getPlatform() === 'ios';
};

/**
 * Check if running on web
 */
export const isWeb = (): boolean => {
  return !isNative();
};

/**
 * Get current platform name
 */
export const getPlatform = (): 'web' | 'ios' | 'android' => {
  return Capacitor.getPlatform() as 'web' | 'ios' | 'android';
};

/**
 * Convert base64 string to Blob
 * Used for converting Capacitor voice recording to uploadable format
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Uint8Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  return new Blob([byteNumbers], { type: mimeType });
}
