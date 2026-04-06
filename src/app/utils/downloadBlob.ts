import { downloadDir, join } from '@tauri-apps/api/path';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

/**
 * Downloads a file in a way that works in both web browsers and Tauri v2.
 *
 * In Tauri v2:
 *   - Opens a native save dialog via @tauri-apps/plugin-dialog
 *   - Writes the file directly to disk via @tauri-apps/plugin-fs
 *   - Uses @tauri-apps/api/path to get the Downloads folder as default location
 *   - Avoids the "Not allowed to navigate top frame to data URL" WebKit error
 *
 * In browsers:
 *   - Uses a temporary <a> element with URL.createObjectURL
 *
 * NOTE: For Tauri v2 support, ensure these plugins are configured in src-tauri/:
 *   1. Add to Cargo.toml:
 *        tauri-plugin-dialog = "2"
 *        tauri-plugin-fs = "2"
 *   2. Add to src/lib.rs:
 *        .plugin(tauri_plugin_dialog::init())
 *        .plugin(tauri_plugin_fs::init())
 *   3. Add to capabilities:
 *        "permissions": ["dialog:default", "fs:default"]
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  // Check if running inside Tauri v2
  const isTauri = '__TAURI_INTERNALS__' in window;

  if (isTauri) {
    try {
      // Get the system Downloads folder path
      const downloadDirPath = await downloadDir();
      // Combine folder path with filename for the default save location
      const defaultPath = await join(downloadDirPath, filename);

      // Open native save dialog with correct default path
      const savePath = await save({ defaultPath });

      // User cancelled the dialog
      if (!savePath) return;

      // Convert Blob to Uint8Array for Tauri FS
      const uint8Array = new Uint8Array(await blob.arrayBuffer());

      // Write file to disk
      await writeFile(savePath, uint8Array);
      console.log('[downloadBlob] File successfully saved to:', savePath);
      return;
    } catch (err) {
      // If Tauri plugins fail, fall back to browser method
      console.error('[downloadBlob] Tauri native save failed, falling back:', err);
    }
  }

  // Browser fallback (also used if Tauri API is unavailable or plugins not configured)
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
