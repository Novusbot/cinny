import { style } from '@vanilla-extract/css';
import { config } from 'folds';

export const CategoryButton = style({
  flexGrow: 1,
});
export const CategoryButtonIcon = style({
  opacity: config.opacity.P400,
});

export const RoomTile = style({
  position: 'relative',
  paddingTop: '8px',
  paddingBottom: '10px',
  '::after': {
    content: "''",
    position: 'absolute',
    bottom: 0,
    right: 0,
    left: '56px',
    height: '1px',
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
  },
});
