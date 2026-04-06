import { Box, Icon, Icons, Text, as, color, config } from 'folds';
import React from 'react';

const warningStyle = { color: color.Warning.Main, opacity: config.opacity.P300 };
const criticalStyle = { color: color.Critical.Main, opacity: config.opacity.P300 };

// Style for deleted message - matches Element design
const deletedMessageStyle = {
  backgroundColor: 'var(--bg-surface-hover, rgba(0, 0, 0, 0.05))',
  color: 'var(--text-secondary, #8a9bae)',
  padding: '8px 12px',
  borderRadius: '8px',
  fontSize: '0.875rem',
  fontWeight: 400,
};

export const MessageDeletedContent = as<'div', { children?: never; reason?: string }>(
  ({ reason, ...props }, ref) => (
    <Box as="span" alignItems="Center" gap="100" style={deletedMessageStyle} {...props} ref={ref}>
      <Icon size="50" src={Icons.Delete} />
      {reason ? (
        <span>Сообщение удалено. {reason}</span>
      ) : (
        <span>Сообщение удалено</span>
      )}
    </Box>
  )
);

export const MessageUnsupportedContent = as<'div', { children?: never }>(({ ...props }, ref) => (
  <Box as="span" alignItems="Center" gap="100" style={criticalStyle} {...props} ref={ref}>
    <Icon size="50" src={Icons.Warning} />
    <i>Unsupported message</i>
  </Box>
));

export const MessageFailedContent = as<'div', { children?: never }>(({ ...props }, ref) => (
  <Box as="span" alignItems="Center" gap="100" style={criticalStyle} {...props} ref={ref}>
    <Icon size="50" src={Icons.Warning} />
    <i>Failed to load message</i>
  </Box>
));

export const MessageBadEncryptedContent = as<'div', { children?: never }>(({ ...props }, ref) => (
  <Box as="span" alignItems="Center" gap="100" style={warningStyle} {...props} ref={ref}>
    <Icon size="50" src={Icons.Lock} />
    <i>Unable to decrypt message</i>
  </Box>
));

export const MessageNotDecryptedContent = as<'div', { children?: never }>(({ ...props }, ref) => (
  <Box as="span" alignItems="Center" gap="100" style={warningStyle} {...props} ref={ref}>
    <Icon size="50" src={Icons.Lock} />
    <i>This message is not decrypted yet</i>
  </Box>
));

export const MessageBrokenContent = as<'div', { children?: never }>(({ ...props }, ref) => (
  <Box as="span" alignItems="Center" gap="100" style={criticalStyle} {...props} ref={ref}>
    <Icon size="50" src={Icons.Warning} />
    <i>Broken message</i>
  </Box>
));

export const MessageEmptyContent = as<'div', { children?: never }>(({ ...props }, ref) => (
  <Box as="span" alignItems="Center" gap="100" style={criticalStyle} {...props} ref={ref}>
    <Icon size="50" src={Icons.Warning} />
    <i>Empty message</i>
  </Box>
));

export const MessageEditedContent = as<'span', { children?: never }>(({ ...props }, ref) => (
  <Text as="span" size="T200" priority="300" {...props} ref={ref}>
    {' (edited)'}
  </Text>
));
