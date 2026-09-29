import React, { MouseEventHandler, useEffect, useMemo, useRef } from 'react';
import { Avatar, Box, config, MenuItem, Scroll, Text, toRem } from 'folds';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useKnownUsers, KnownUser } from '../../hooks/useKnownUsers';
import { useUserDirectorySearch } from '../../hooks/useUserDirectorySearch';
import { useAsyncSearch, UseAsyncSearchOptions } from '../../hooks/useAsyncSearch';
import { getMxIdLocalPart, getMxIdServer, mxcUrlToHttp } from '../../utils/matrix';
import { nameInitials } from '../../utils/common';
import { UserAvatar } from '../../components/user-avatar';
import { highlightText, makeHighlightRegex } from '../../plugins/react-custom-html-parser';

const RESULT_LIMIT = 20;

const SEARCH_OPTIONS: UseAsyncSearchOptions = {
  limit: RESULT_LIMIT,
  matchOptions: {
    contain: true,
  },
  normalizeOptions: {
    ignoreWhitespace: false,
  },
};

const getPeopleUserStr = (user: KnownUser): string[] => {
  const localPart = getMxIdLocalPart(user.userId) ?? user.userId;
  const displayName =
    user.displayName && user.displayName !== user.userId ? user.displayName : undefined;

  return displayName ? [displayName, localPart] : [localPart];
};

export type PeopleSearchState = {
  users: KnownUser[];
  loading: boolean;
  dmRoomIdOf: (userId: string) => string | undefined;
};

/**
 * Merges the local user list (m.direct + members of joined rooms, filtered by
 * useAsyncSearch) with homeserver user directory results. Server entries win on
 * conflict because they carry fresh display names and avatars.
 */
export const usePeopleSearch = (query: string): PeopleSearchState => {
  const { users: knownUsers, dmRoomIdOf } = useKnownUsers();
  const [localResult, search, resetSearch] = useAsyncSearch(
    knownUsers,
    getPeopleUserStr,
    SEARCH_OPTIONS
  );
  const { loading, results: directoryResults } = useUserDirectorySearch(query);

  useEffect(() => {
    if (query) search(query);
    else resetSearch();
  }, [query, resetSearch, search]);

  const users = useMemo(() => {
    const merged = new Map<string, KnownUser>();

    (localResult?.items ?? []).forEach((user) => merged.set(user.userId, user));
    directoryResults.forEach((user) => merged.set(user.userId, user));

    return Array.from(merged.values()).slice(0, RESULT_LIMIT);
  }, [directoryResults, localResult]);

  return useMemo(() => ({ users, loading, dmRoomIdOf }), [dmRoomIdOf, loading, users]);
};

type PeopleSearchProps = {
  query: string;
  users: KnownUser[];
  loading: boolean;
  focusedIndex: number;
  onSelectUser: (userId: string) => void;
};

export function PeopleSearch({
  query,
  users,
  loading,
  focusedIndex,
  onSelectUser,
}: PeopleSearchProps) {
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const scrollRef = useRef<HTMLDivElement>(null);

  const highlightRegex = query ? makeHighlightRegex(query.split(' ')) : undefined;

  const handleItemClick: MouseEventHandler<HTMLButtonElement> = (evt) => {
    const userId = evt.currentTarget.getAttribute('data-user-id');
    if (!userId) return;
    onSelectUser(userId);
  };

  useEffect(() => {
    const scrollView = scrollRef.current;
    const focusedItem = scrollView?.querySelector(`[data-focus-index="${focusedIndex}"]`);
    if (focusedItem && scrollView) {
      focusedItem.scrollIntoView({ block: 'center' });
    }
  }, [focusedIndex]);

  if (users.length === 0) {
    return (
      <Box
        style={{ paddingTop: config.space.S700 }}
        grow="Yes"
        alignItems="Center"
        justifyContent="Center"
        direction="Column"
        gap="100"
      >
        <Text size="H6" align="Center">
          {loading ? 'Searching People' : 'No People Found'}
        </Text>
        {!loading && (
          <Text size="T200" align="Center">
            {`No match found for "@${query}".`}
          </Text>
        )}
      </Box>
    );
  }

  return (
    <Scroll ref={scrollRef} size="300" hideTrack style={{ maxHeight: toRem(320) }}>
      <div style={{ padding: config.space.S400, paddingRight: config.space.S200 }}>
        {users.map((user, index) => {
          const localPart = getMxIdLocalPart(user.userId) ?? user.userId;
          const displayName =
            user.displayName && user.displayName !== user.userId ? user.displayName : localPart;
          const server = getMxIdServer(user.userId);
          const avatarUrl = user.avatarMxc
            ? mxcUrlToHttp(mx, user.avatarMxc, useAuthentication, 96, 96, 'crop')
            : null;

          return (
            <MenuItem
              key={user.userId}
              as="button"
              data-focus-index={index}
              data-user-id={user.userId}
              onClick={handleItemClick}
              variant={focusedIndex === index ? 'Primary' : 'Surface'}
              aria-pressed={focusedIndex === index}
              radii="400"
              after={
                server ? (
                  <Text size="T200" priority="300" truncate>
                    <b>{server}</b>
                  </Text>
                ) : undefined
              }
              before={
                <Avatar size="200" radii="400">
                  <UserAvatar
                    userId={user.userId}
                    src={avatarUrl ?? undefined}
                    alt={displayName}
                    renderFallback={() => (
                      <Text as="span" size="T400">
                        {nameInitials(displayName)}
                      </Text>
                    )}
                  />
                </Avatar>
              }
            >
              <Box grow="Yes" alignItems="Center" gap="100">
                <Text size="T400" truncate>
                  {highlightRegex ? highlightText(highlightRegex, [displayName]) : displayName}
                </Text>
                <Text as="span" size="T200" priority="300" truncate>
                  @{highlightRegex ? highlightText(highlightRegex, [localPart]) : localPart}
                </Text>
              </Box>
            </MenuItem>
          );
        })}
      </div>
    </Scroll>
  );
}
