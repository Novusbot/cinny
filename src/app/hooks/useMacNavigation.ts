import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHomePath } from '../pages/pathUtils';
import { hasOpenDialog, tryCloseTopDialog } from '../utils/dialog';

const SWIPE_DEBOUNCE_MS = 1000; // 1 second cooldown to prevent double-triggering
const SWIPE_DELTA_X_THRESHOLD = -40;
const SWIPE_DELTA_Y_THRESHOLD = 10;

/**
 * Hook for macOS trackpad / Magic Mouse swipe navigation.
 * Swipe right (negative deltaX) navigates back to the home screen.
 *
 * @param onSwipeRight - Optional callback to call before navigating home.
 *   If the callback returns true, navigation is prevented (swipe was consumed).
 *
 * NOTE: Escape key is handled separately by the parent component
 * (e.g. Room.tsx via useKeyDown) so that markAsRead can also run.
 */
export const useMacNavigation = (onSwipeRight?: () => boolean) => {
  const navigate = useNavigate();
  const swipeDebounceRef = useRef<number | null>(null);

  const handleNavigateHome = useCallback(() => {
    navigate(getHomePath(), { replace: false });
  }, [navigate]);

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      // Swipe right on trackpad/magic mouse produces negative deltaX
      if (
        event.deltaX <= SWIPE_DELTA_X_THRESHOLD &&
        Math.abs(event.deltaY) < SWIPE_DELTA_Y_THRESHOLD
      ) {
        // Debounce: prevent multiple triggers from the same swipe gesture
        if (swipeDebounceRef.current !== null) return;

        // Set cooldown IMMEDIATELY to block all subsequent wheel events
        // from this same physical swipe gesture
        swipeDebounceRef.current = window.setTimeout(() => {
          swipeDebounceRef.current = null;
        }, SWIPE_DEBOUNCE_MS);

        // UNIVERSAL CHECK (Level 1: Modals/Dialogs)
        // Check if any modal dialogs are open (InsertLinkDialog, ForwardDialog, etc.)
        // If yes, close them instead of navigating away from thread/room
        if (hasOpenDialog()) {
          // Simulate Escape key to close the topmost modal
          tryCloseTopDialog();
          return; // Consume the swipe - don't proceed to thread/room navigation
        }

        // Check if swipe was consumed (e.g., closing a thread)
        if (onSwipeRight?.()) {
          return; // Swipe consumed, don't navigate home
        }

        // If not consumed, navigate home (Level 3: Room)
        handleNavigateHome();
      }
    },
    [handleNavigateHome, onSwipeRight]
  );

  useEffect(() => {
    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      if (swipeDebounceRef.current !== null) {
        clearTimeout(swipeDebounceRef.current);
      }
    };
  }, [handleWheel]);
};
