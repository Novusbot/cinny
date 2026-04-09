import { style } from '@vanilla-extract/css';
import { DefaultReset, config, toRem, color } from 'folds';

export const MessageBase = style({
  position: 'relative',
});
export const MessageBaseBubbleCollapsed = style({
  paddingTop: 0,
});

export const MessageOptionsBase = style([
  DefaultReset,
  {
    position: 'absolute',
    top: toRem(-30),
    right: 0,
    zIndex: 1,
  },
]);
export const MessageOptionsBar = style([
  DefaultReset,
  {
    padding: config.space.S100,
  },
]);

export const BubbleAvatarBase = style({
  paddingTop: 0,
});

export const MessageAvatar = style({
  cursor: 'pointer',
});

export const MessageQuickReaction = style({
  minWidth: toRem(32),
});

export const MessageMenuGroup = style({
  padding: config.space.S100,
});

export const MessageMenuItemText = style({
  flexGrow: 1,
});

export const ReactionsContainer = style({
  selectors: {
    '&:empty': {
      display: 'none',
    },
  },
});

export const ReactionsTooltipText = style({
  wordBreak: 'break-word',
});

export const ThreadSummaryButton = style({
  maxWidth: '100%',
  width: 'max-content',
  marginTop: config.space.S100,
  backgroundColor: color.SurfaceVariant.Container,
  border: `1px solid transparent`,
  padding: `${toRem(4)} ${toRem(8)}`,
  fontSize: toRem(12),
  selectors: {
    '&:hover': {
      backgroundColor: color.SurfaceVariant.ContainerHover,
    },
  },
});

export const ThreadSummaryContent = style({
  width: '100%',
  overflow: 'hidden',
  minWidth: 0,
  color: color.SurfaceVariant.OnContainer,
});

export const ThreadSummaryCountBox = style({
  flexShrink: 0,
});

export const ThreadSummaryPreviewText = style({
  flexShrink: 1,
  minWidth: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const ThreadSummaryAvatarBase = style({
  paddingTop: 0,
  flexShrink: 0,
});
