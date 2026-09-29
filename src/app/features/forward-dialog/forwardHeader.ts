import { Room } from 'matrix-js-sdk';
import { getMxIdLocalPart } from '../../utils/matrix';
import { getMatrixToRoomEvent, getMatrixToUser } from '../../plugins/matrix-to';
import { getViaServers } from '../../plugins/via-servers';
import { sanitizeText } from '../../utils/sanitize';
import { getMemberDisplayName } from '../../utils/room';

export type ForwardHeader = {
  text: string;
  html: string;
};

type ForwardHeaderOpts = {
  room: Room | undefined;
  roomId: string;
  eventId: string;
  senderId: string | undefined;
  senderName: string | undefined;
  isDirectRoom: boolean;
};

const getSenderName = (
  room: Room | undefined,
  senderId: string | undefined,
  senderName: string | undefined
): string => {
  // 1) display name из state комнаты — самое точное ("Иван Петров")
  if (room && senderId) {
    const memberName = getMemberDisplayName(room, senderId);
    if (memberName) return memberName;
  }
  // 2) имя, которое уже распознал SDK у загруженного события
  if (senderName) return senderName;
  // 3) localpart mxid, если имени нет нигде
  return getMxIdLocalPart(senderId || '') || 'Unknown';
};

/**
 * Строит заголовок "Переслано от ..." для пересланного сообщения.
 *
 * Личка (isDirectRoom) — название комнаты равно имени собеседника, поэтому
 * "из <Имя>" читается как "из Сергей". В этом случае оставляем только
 * отправителя, а имя ведёт на его профиль, а не на приватную комнату.
 */
export const buildForwardHeader = ({
  room,
  roomId,
  eventId,
  senderId,
  senderName,
  isDirectRoom,
}: ForwardHeaderOpts): ForwardHeader => {
  const name = getSenderName(room, senderId, senderName);

  if (isDirectRoom || !room) {
    const senderLink = senderId
      ? `<a href="${getMatrixToUser(senderId)}">@${sanitizeText(name)}</a>`
      : `@${sanitizeText(name)}`;

    return {
      text: `Переслано от @${name}\n`,
      html: `<sup><font color="#888888"><em>Переслано от:</em> ${senderLink}</font></sup><br/>`,
    };
  }

  const roomName = room.name || roomId;
  const messageLink = getMatrixToRoomEvent(roomId, eventId, getViaServers(room));

  return {
    text: `Переслано от ${name} из ${roomName}\n`,
    html: `<sup><font color="#888888"><em>Переслано от:</em> ${sanitizeText(
      name
    )} <em>из <a href="${messageLink}">${sanitizeText(roomName)}</a></em></font></sup><br/>`,
  };
};
