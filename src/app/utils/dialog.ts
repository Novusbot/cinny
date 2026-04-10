/**
 * Utility functions to detect if there are open modal dialogs.
 * Used by global navigation handlers to respect Z-index hierarchy.
 */

/**
 * Checks if any modal dialogs are currently open in the application.
 * This examines multiple indicators to ensure comprehensive detection.
 * 
 * @returns true if any modal/dialog is currently open
 */
export function hasOpenDialog(): boolean {
  // Check 1: Folds library uses Overlay components which render into portal containers
  // The Search modal checks for 'portalContainer' - use the same approach
  const portalContainer = document.getElementById('portalContainer');
  if (portalContainer && portalContainer.children.length > 0) {
    return true;
  }

  // Check 2: Look for any elements with role="dialog" (standard ARIA attribute for modals)
  if (document.querySelector('[role="dialog"]')) {
    return true;
  }

  // Check 3: Look for Folds Modal components by their common attributes
  // Folds Modals typically have specific data attributes or classes
  // Check for overlay/backdrop elements that indicate open modals
  if (document.querySelector('[class*="Overlay"], [class*="Modal"]')) {
    return true;
  }

  return false;
}

/**
 * Programmatically closes the topmost modal dialog by dispatching an Escape key event.
 * Most modals listen for Escape key to close themselves.
 * 
 * @returns true if a dialog was found and attempted to close, false otherwise
 */
export function tryCloseTopDialog(): boolean {
  if (!hasOpenDialog()) {
    return false;
  }

  // Dispatch Escape key event to close the topmost modal
  // Most modals (InsertLinkDialog, ForwardDialog, etc.) listen for Escape
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true,
    })
  );

  return true;
}
