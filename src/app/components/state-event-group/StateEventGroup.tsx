import React, { useState, ReactNode } from 'react';
import { Box, Text, config, color } from 'folds';
import * as css from './StateEventGroup.css';

type StateEventGroupProps = {
  events: ReactNode[];
  collapsedCount: number;
};

export function StateEventGroup({ events, collapsedCount }: StateEventGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (events.length <= 1) {
    return <>{events[0]}</>;
  }

  return (
    <Box direction="Column" className={css.StateEventGroupContainer}>
      {isExpanded ? (
        <>
          {events.map((ev, idx) => (
            <React.Fragment key={idx}>{ev}</React.Fragment>
          ))}
          <button
            type="button"
            className={css.StateEventGroupToggle}
            onClick={() => setIsExpanded(false)}
          >
            <Text size="T200" priority="300">
              Скрыть
            </Text>
          </button>
        </>
      ) : (
        <>
          {events[events.length - 1]}
          <button
            type="button"
            className={css.StateEventGroupToggle}
            onClick={() => setIsExpanded(true)}
          >
            <Text size="T200" priority="300">
              +{collapsedCount} больше событий
            </Text>
          </button>
        </>
      )}
    </Box>
  );
}
