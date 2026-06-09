import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { getHomePath } from '../pages/pathUtils';
import { hasOpenDialogsAtom } from '../state/navigationStack';

const SWIPE_DEBOUNCE_MS = 1000;
const SWIPE_DELTA_X_THRESHOLD = -40;
const SWIPE_DELTA_Y_THRESHOLD = 10;

export const useMacNavigation = (
  onSwipeRight?: () => boolean,
  navigateBack?: () => void
) => {
  const navigate = useNavigate();
  const swipeDebounceRef = useRef<number | null>(null);
  const hasOpenDialogs = useAtomValue(hasOpenDialogsAtom);

  const handleNavigateBack = useCallback(() => {
    if (navigateBack) {
      navigateBack();
    } else {
      navigate(getHomePath(), { replace: false });
    }
  }, [navigate, navigateBack]);

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (
        event.deltaX <= SWIPE_DELTA_X_THRESHOLD &&
        Math.abs(event.deltaY) < SWIPE_DELTA_Y_THRESHOLD
      ) {
        if (swipeDebounceRef.current !== null) {
          return;
        }

        swipeDebounceRef.current = window.setTimeout(() => {
          swipeDebounceRef.current = null;
        }, SWIPE_DEBOUNCE_MS);

        if (hasOpenDialogs) {
          document.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'Escape',
              code: 'Escape',
              keyCode: 27,
              which: 27,
              bubbles: true,
            })
          );
          return;
        }

        if (onSwipeRight?.()) {
          return;
        }

        handleNavigateBack();
      }
    },
    [handleNavigateBack, onSwipeRight, hasOpenDialogs]
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