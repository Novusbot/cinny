import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

/**
 * Modal из folds задаёт только max-width/max-height. Без min-width содержимое
 * сжимается до ширины самого узкого слова, и строка поиска схлопывается.
 */
export const ForwardDialogModal = style({
  minWidth: toRem(440),
  maxWidth: toRem(460),
  maxHeight: '80vh',
});

export const ForwardDialogHeader = style({
  padding: `${config.space.S200} ${config.space.S200} ${config.space.S200} ${config.space.S400}`,
  borderBottomWidth: config.borderWidth.B300,
});

/* --- Превью сообщения ------------------------------------------------- */

export const ForwardDialogPreview = style({
  margin: `${config.space.S300} ${config.space.S400} 0`,
  padding: config.space.S300,
  gap: config.space.S100,
  backgroundColor: color.SurfaceVariant.Container,
  borderRadius: config.radii.R400,
});

/**
 * folds `Box` — flex-контейнер, поэтому `Input` без явной ширины сжимается
 * до ширины самого поля (то есть почти до нуля) и строка поиска вырождается
 * в узкую полоску. Ширину задаём на компоненте.
 */
export const ForwardDialogInput = style({
  width: '100%',
});
/**
 * Превью ограничено двумя строками: длинный текст не должен растягивать
 * диалог — полный текст всё равно уедет вместе с сообщением.
 */
export const ForwardDialogPreviewText = style({
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-wrap',
});

/* --- Поиск и комментарий --------------------------------------------- */

export const ForwardDialogSearch = style({
  padding: `${config.space.S400} ${config.space.S400} 0`,
});

export const ForwardDialogComment = style({
  padding: `${config.space.S300} ${config.space.S400} 0`,
});

/* --- Список комнат ---------------------------------------------------- */

export const ForwardDialogList = style({
  flexGrow: 1,
  minHeight: 0,
  padding: config.space.S300,
});

/**
 * Строка комнаты целиком кликабельна и реагирует на hover как пункт меню;
 * внутри неё нет вложенных кнопок, поэтому вложенный button ломал бы a11y.
 */
export const ForwardDialogRow = style({
  cursor: 'pointer',
  minHeight: toRem(56),
  paddingRight: config.space.S100,
  borderRadius: config.radii.R400,
  backgroundColor: color.SurfaceVariant.Container,
  ':hover': {
    backgroundColor: color.SurfaceVariant.ContainerHover,
  },
  ':active': {
    backgroundColor: color.SurfaceVariant.ContainerActive,
  },
  selectors: {
    '&[aria-disabled=true]': {
      cursor: 'default',
      opacity: config.opacity.Disabled,
    },
  },
});

export const ForwardDialogRowName = style({
  minWidth: 0,
});

/** Плашка действия — не кнопка, а часть строки: действие и есть клик по строке. */
export const ForwardDialogRowSend = style({
  flexShrink: 0,
  gap: config.space.S100,
  padding: `${config.space.S100} ${config.space.S300}`,
  borderRadius: config.radii.Pill,
  backgroundColor: color.Primary.Container,
  color: color.Primary.OnContainer,
});

/* --- Пустое состояние ------------------------------------------------- */

export const ForwardDialogEmpty = style({
  padding: `${config.space.S700} ${config.space.S400}`,
  gap: config.space.S100,
});
