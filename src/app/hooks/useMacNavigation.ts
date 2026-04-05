import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHomePath } from '../pages/pathUtils';

const SWIPE_DEBOUNCE_MS = 500;
const SWIPE_DELTA_X_THRESHOLD = -40;
const SWIPE_DELTA_Y_THRESHOLD = 10;

/**
 * Hook for macOS trackpad / Magic Mouse swipe navigation.
 * Swipe right (negative deltaX) navigates back to the home screen.
 *
 * NOTE: Escape key is handled separately by the parent component
 * (e.g. Room.tsx via useKeyDown) so that markAsRead can also run.
 */
export const useMacNavigation = () => {
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

        handleNavigateHome();

        swipeDebounceRef.current = window.setTimeout(() => {
          swipeDebounceRef.current = null;
        }, SWIPE_DEBOUNCE_MS);
      }
    },
    [handleNavigateHome]
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
