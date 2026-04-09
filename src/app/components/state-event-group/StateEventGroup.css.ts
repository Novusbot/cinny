import { style } from '@vanilla-extract/css';
import { config, toRem } from 'folds';

export const StateEventGroupContainer = style({
  selectors: {
    '&:hover': {
      opacity: config.opacity.P500,
    },
  },
});

export const StateEventGroupToggle = style({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: `${toRem(4)} ${toRem(8)}`,
  marginLeft: toRem(48),
  marginTop: toRem(2),
  marginBottom: toRem(2),
  borderRadius: toRem(4),
  selectors: {
    '&:hover': {
      backgroundColor: 'rgba(141, 150, 160, 0.1)',
    },
  },
});
