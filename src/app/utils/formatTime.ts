/**
 * Formats timestamp to Telegram-style time/date
 * - Today: "HH:mm" (e.g., "14:30")
 * - Yesterday: "Вчера" 
 * - This week: Day name (e.g., "Пн", "Вт")
 * - Older: DD.MM.YYYY (e.g., "05.04.23")
 */
export const formatLastMessageTime = (timestamp: Date | null): string => {
  if (!timestamp) return '';

  const now = new Date();
  const messageDate = new Date(timestamp.getTime());
  
  // Reset time parts for comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
  
  const diffTime = today.getTime() - messageDay.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    // Today - show time
    return messageDate.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  
  if (diffDays === 1) {
    // Yesterday
    return 'Вчера';
  }
  
  if (diffDays < 7) {
    // This week - show short day name
    return messageDate.toLocaleDateString('ru-RU', {
      weekday: 'short',
    });
  }
  
  // Older - show date
  return messageDate.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
};
