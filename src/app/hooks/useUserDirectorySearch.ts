import { useCallback, useEffect, useRef, useState } from 'react';
import { useAlive } from './useAlive';
import { useDebounce } from './useDebounce';
import { useMatrixClient } from './useMatrixClient';

const MIN_TERM_LENGTH = 2;
const DEBOUNCE_WAIT = 250;
const RESULT_LIMIT = 20;

export type DirectoryUser = {
  userId: string;
  displayName?: string;
  avatarMxc?: string;
};

type DirectoryUserResult = {
  user_id: string;
  display_name?: string;
  avatar_url?: string;
};

export type UserDirectorySearchState = {
  loading: boolean;
  results: DirectoryUser[];
};

const EMPTY: UserDirectorySearchState = { loading: false, results: [] };

/**
 * Searches the homeserver user directory (`/_matrix/client/v3/user_directory/search`).
 *
 * - no request for terms shorter than MIN_TERM_LENGTH
 * - debounced by DEBOUNCE_WAIT
 * - discards out-of-order responses (stale guard on request id)
 * - never surfaces errors: a homeserver without user_directory support
 *   silently degrades to no server results
 */
export const useUserDirectorySearch = (term: string): UserDirectorySearchState => {
  const mx = useMatrixClient();
  const alive = useAlive();

  const [state, setState] = useState<UserDirectorySearchState>(EMPTY);
  const requestIdRef = useRef(0);

  const reset = useCallback(() => {
    // invalidate any in-flight request
    requestIdRef.current += 1;
    setState(EMPTY);
  }, []);

  const runSearch = useCallback(
    async (searchTerm: string) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setState({ loading: true, results: [] });

      try {
        const response = await mx.searchUserDirectory({ term: searchTerm, limit: RESULT_LIMIT });

        if (!alive() || requestId !== requestIdRef.current) return;

        const myUserId = mx.getSafeUserId();
        const results: DirectoryUser[] = [];
        const seen = new Set<string>();

        response.results.forEach((item: DirectoryUserResult) => {
          const userId = item?.user_id;
          if (typeof userId !== 'string' || userId === myUserId || seen.has(userId)) return;
          seen.add(userId);
          results.push({
            userId,
            displayName: item.display_name,
            avatarMxc: item.avatar_url,
          });
        });

        if (!alive() || requestId !== requestIdRef.current) return;
        setState({ loading: false, results });
      } catch {
        // unsupported endpoint (M_UNRECOGNIZED) or network failure:
        // fall back to local results silently
        if (!alive() || requestId !== requestIdRef.current) return;
        setState({ loading: false, results: [] });
      }
    },
    [alive, mx]
  );

  const debouncedSearch = useDebounce(runSearch, { wait: DEBOUNCE_WAIT });

  useEffect(() => {
    const searchTerm = term.trim();

    if (searchTerm.length < MIN_TERM_LENGTH) {
      reset();
      return;
    }

    debouncedSearch(searchTerm);
  }, [debouncedSearch, reset, term]);

  return state;
};
