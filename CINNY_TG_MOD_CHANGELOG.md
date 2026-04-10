***

# Документация модификаций: Cinny Telegram Edition

Данный документ описывает кастомные изменения, внесенные в исходный код клиента Cinny для адаптации UI/UX под паттерны мессенджера Telegram.

## 1. Нативная навигация и жесты (macOS)
**Цель:** Добавить поддержку свайпов с Magic Mouse / трекпада и горячих клавиш для управления комнатами и сообщениями.

* **Глобальное закрытие комнаты (Назад / ESC):**
    * **Файл:** Компоненты верхнего уровня (например, `RoomView.tsx` или `App.tsx`).
    * **Реализация:** Добавлен слушатель `keydown` на клавишу `Escape` и глобальный слушатель `wheel`. При `e.deltaX < -60` (горизонтальный свайп слева-направо) триггерится функция закрытия текущей комнаты (возврат к "Welcome to Cinny").


## 2. Единая лента чатов (Все комнаты) на вкладке Home
**Цель:** Избавиться от скрытия комнат, привязанных к Spaces, и вывести абсолютно все рабочие группы на главный экран (аналог папки "Все чаты" в ТГ).

* **Файл:** `src/app/hooks/useHomeRooms.ts`
* **Реализация:** * Изменена логика фильтрации списка. Встроенный хук `useOrphanRooms` (отвечающий за фильтрацию комнат без родительских пространств `!roomToParents.has(roomId)`) заменен на `useRooms`.
    * **Код:** `const rooms = useRooms(mx, allRoomsAtom, mDirects);`
    * **Результат:** Вкладка Home теперь рендерит массив всех групповых комнат, в которых состоит пользователь, исключая только личные сообщения (`mDirects`). Логика внутри самих Пространств (Spaces) осталась нетронутой.

## 3. Объединение Личных сообщений (DM) и Групп (Rooms)
**Цель:** Вывести личные чаты над группами на едином экране вкладки Home.

* **Файл:** `Home.tsx` (или `HomeNav.tsx`).
* **Реализация:**
    * Импортирован хук `useDirectRooms` для получения массива личных переписок.
    * В компонент добавлены две независимые сворачиваемые секции (`NavCategory`):
        1.  **CHATS** (id: `"home|dm"`): использует данные `useDirectRooms()`, рендерит элементы с аватарами (пропс `showAvatar`, `direct`).
        2.  **ROOMS** (id: `"home|room"`): стандартный список групп.
    * Обе секции используют общий стейт `closedCategories` для независимого сворачивания/разворачивания.

## 4. Telegram-стиль предпросмотра сообщений (Имена и Аватарки)
**Цель:** Четкое визуальное разделение автора и текста сообщения в списке чатов.

* **Извлечение аватара:** В `useRoomLastMessage.ts` добавлено получение URL аватарки отправителя (`event.sender.getMxcAvatarUrl()`), которое возвращается как `senderAvatarUrl`.
* **Верстка (`RoomNavItem.tsx`):**
    * **Контейнер:** `display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;`
    * **Аватар отправителя:** Рендерится как `<img>` 16x16px с `border-radius: 50%` и `vertical-align: text-bottom` перед именем (только для групповых чатов).
    * **Имя / Префикс "Вы: ":** Жестко задан стиль `font-weight: 500; color: var(--text-primary);`. Двоеточие удалено, оставлен `margin-right: 4px`.
    * **Текст сообщения:** Жестко задан стиль `font-weight: 400; color: #8E8E93; opacity: 0.7;`.

## 5. Визуальное разделение чатов (Воздух и Линия)
**Цель:** Избавиться от эффекта "слипания" чатов и добавить iOS/Telegram разделитель.

* **Файлы:** `styles.css.ts` и `RoomNavItem.tsx`.
* **Реализация разделителя:** * Добавлен класс `.RoomTile` с `position: relative; padding: 8px 0 10px 0;`.
    * Внедрен псевдоэлемент `::after` для создания тонкой линии, не доходящей до левого края:
        `bottom: 0; right: 0; left: 56px; height: 1px; background-color: rgba(128, 128, 128, 0.15);`.
* **Компенсация виртуализатора:** В `Home.tsx` (в настройках хука виртуализации) базовое значение высоты элемента (`estimateSize` / `itemSize`) увеличено на ~12-16px для компенсации новых внутренних отступов (`padding`), чтобы текст не "падал" на линию.



## 6. Telegram-форматирование времени последнего сообщения
**Цель:** Вывести относительное время последнего сообщения в правом верхнем углу списка чатов.

* **Извлечение времени:** В хуке `useRoomLastMessage.ts` добавлено возвращение `timestamp: event.getDate()`.
* **Новый утилитный файл:** Создан `utils/formatTime.ts` с функцией `formatLastMessageTime()`, реализующей логику сокращения:
    * Сегодня → `HH:mm`
    * Вчера → `Вчера`
    * Эта неделя → Короткий день недели (`Пн`, `Вт`)
    * Старше → Формат даты (`DD.MM.YY` или `D MMM`)
* **Верстка правой колонки (`RoomNavItem.tsx`):**
    * Создан отдельный `flex`-контейнер справа: `display: flex; flex-direction: column; align-items: flex-end; margin-left: auto; flex-shrink: 0; padding-left: 8px;`.
    * Внутри него два блока:
        1.  `<div>` со временем (`font-size: 0.7rem; color: #8E8E93; margin-bottom: 4px;`).
        2.  Блок с иконками (Mute/UnreadBadge).
    * Центральный блок с названием комнаты и текстом получил `flex: 1` и `min-width: 0`, чтобы длинный текст обрезался многоточием и не вытеснял время за край экрана.

## 7. Функция пересылки сообщений (Forward) — UI модального окна + кнопка в меню
**Цель:** Добавить возможность пересылки сообщений в другие чаты, как в Telegram/Element.

* **Новые файлы:**
    * `src/app/features/forward-dialog/ForwardDialog.tsx` — основной компонент диалога
    * `src/app/features/forward-dialog/ForwardDialogRenderer.tsx` — рендерер для глобального подключения
    * `src/app/features/forward-dialog/index.ts` — экспорты
    * `src/app/state/forwardDialog.ts` — Jotai atom для управления состоянием диалога
    * `src/app/state/hooks/forwardDialog.ts` — хуки `useOpenForwardDialog`, `useCloseForwardDialog`

* **Переиспользование существующего UI:**
    * Использованы готовые хуки Cinny: `useAsyncSearch` для поиска комнат, `useRooms`, `useDirects` для получения списка комнат
    * Стандартные компоненты из библиотеки `folds`: `Modal`, `Overlay`, `Input`, `Avatar`, `Scroll`, `MenuItem`
    * Компонент `RoomAvatar` для отображения аватаров комнат

* **Структура диалога:**
    1.  **Заголовок:** "Переслать сообщение"
    2.  **Предпросмотр:** Блок с именем отправителя и текстом пересылаемого сообщения (обрезается до 100 символов)
    3.  **Поиск:** Поле ввода с иконкой поиска, фильтрация комнат по имени
    4.  **Список комнат:** Отфильтрованный список с аватарами, названиями и кнопкой "Отправить"

* **Интеграция в контекстное меню:**
    * **Файл:** `src/app/features/room/message/Message.tsx`
    * **Расположение:** После пункта "Reply in Thread"
    * **Иконка:** `Icons.ArrowRight`
    * **Текст:** "Переслать"
    * **Логика:** При клике вызывается `openForwardDialog({ eventToForward: mEvent, roomId: room.roomId })`

* **Глобальное подключение:**
    * `ForwardDialogRenderer` добавлен в `Router.tsx` рядом с другими глобальными модальными окнами (`SearchModalRenderer`, `CreateRoomModalRenderer`, и др.)
    * Управление через Jotai atom: `useOpenForwardDialog({ eventToForward, roomId })`

* **Логика (полностью реализована):**
    * **Защита от двойного клика:** `if (sendingRoomId) return;`
    * **Расшифровка:** Используется `getClearContent()` для получения расшифрованного контента
    * **Очистка связей:** Удаляется `m.relates_to` чтобы сообщение не было привязано к старому треду
    * **Пометка "Переслано от...":**
        * Для текстовых сообщений (`m.text`, `m.notice`, `m.emote`) добавляется заголовок
        * Формат: `Переслано от {senderName} из {roomName}`
        * HTML версия с активной ссылкой на оригинал: `https://matrix.to/#/{roomId}/{eventId}`
        * Cinny автоматически перехватывает эти ссылки и показывает оригинал
    * **Обратная связь:** Текст кнопки меняется на "Отправка..." во время отправки
    * **Обработка ошибок:** `try/catch` с логом ошибки

## 8. Поведение тредов как в Element — скрытие ответов и кнопка "X replies"
**Цель:** Скрыть ответы тредов из главной ленты и добавить кнопку для просмотра ответов на корневом сообщении.

* **Фильтрация ответов тредов:**
    * **Файл:** `src/app/features/room/RoomTimeline.tsx`
    * **Реализация:** В `eventRenderer` добавлена проверка `mEvent.threadRootId !== undefined`
    * Если сообщение является ответом в треде (`isThreadReply === true`), оно не рендерится в главной ленте
    * Корневые сообщения тредов остаются видимыми

* **Кнопка "X replies":**
    * **Файл:** `src/app/features/room/message/Message.tsx`
    * **Реализация:**
        * Проверка является ли сообщение корнем треда: `room.getLiveTimeline().getEvents().filter(e => e.threadRootId === mEventId).length`
        * Если есть ответы (`replyCount > 0`), отображается кнопка под текстом сообщения
        * Формат кнопки: `{replyCount} replies` с иконкой `Icons.Thread`
        * Стили: `Button` из folds, variant="Surface", fill="None", radii="Pill"

* **Просмотр треда (ThreadTimeline):**
    * **Файл:** `src/app/features/room/ThreadTimeline.tsx`
    * **Реализация:**
        * Использует те же данные, что и RoomTimeline (`room.getLiveTimeline().getEvents()`)
        * Рендерит корневое сообщение + все ответы через `<Message>` + `<RenderMessageContent>`
        * Визуальная линия слева для ответов (`borderLeft: 2px solid`)
        * Отступ под размер аватарки (`marginLeft: 48px, paddingLeft: 16px`)

* **Навигация:**
    * **Файл:** `src/app/features/room/RoomView.tsx`
    * Глобальный стейт `activeThread` (Jotai atom)
    * Главная лента всегда в DOM (`display: none` при активном треде) для сохранения позиции скролла
    * Thread view появляется поверх через `position: absolute`
    * **Очистка стейта:** `useEffect` сбрасывает `activeThread` при смене комнаты

* **Шапка чата (RoomViewHeader):**
    * В режиме треда: кнопка "Назад" + "Тред: {room.name}"
    * Тема комнаты скрыта
    * Маленькая аватарка комнаты

* **Поле ввода (RoomInput):**
    * Автоматическая отправка в тред когда `activeThread` активен
    * `content['m.relates_to'] = { rel_type: 'm.thread', event_id: activeThread, is_falling_back: true }`

* **Перехват жестов навигации:**
    * **Файлы:** `src/app/features/room/Room.tsx`, `src/app/hooks/useMacNavigation.ts`
    * Свайп и ESC теперь закрывают тред (если открыт), а не комнату
    * `useMacNavigation` принимает callback `onSwipeRight` для перехвата жеста
    * Обработчик ESC проверяет `activeThread` перед навигацией домой
    * Приоритет: 1) Закрыть тред → 2) Закрыть комнату

## 10. Исправление пропадания тредов при удалении корневого сообщения
**Цель:** При удалении (редации) корневого сообщения треда, тред и его ответы должны оставаться доступными.

* **Проблема:** В Cinny при удалении корневого сообщения треда (`mEvent.isRedacted()`), оно полностью скрывалось из таймлайна, из-за чего пропадала кнопка входа в тред и пользователи не могли прочитать ответы.

* **Решение:** В `RoomTimeline.tsx` добавлена проверка — если удалённое сообщение является корнем треда с ответами, оно **не скрывается**, а отображается как "Сообщение удалено" с сохранением кнопки треда.

* **Реализация (`src/app/features/room/RoomTimeline.tsx`):**
    ```typescript
    // Hide redacted events UNLESS they are thread roots with replies
    const hasThreadReplies = mEventId
      ? room.getLiveTimeline().getEvents().some((e) => e.threadRootId === mEventId)
      : false;
    if (mEvent.isRedacted() && !showHiddenEvents && !hasThreadReplies) {
      return null;
    }
    ```

* **Как это работает:**
    | Ситуация | Поведение |
    |----------|-----------|
    | Обычное удалённое сообщение | Скрыто (как раньше) |
    | Удалённое сообщение **без** ответов в треде | Скрыто (как раньше) |
    | Удалённое сообщение **с** ответами в треде | Показывается заглушка "This message has been deleted" + кнопка треда |

* **Компоненты:**
    * Заглушка удалённого сообщения: `MessageDeletedContent` в `FallbackContent.tsx` — показывает иконку корзины и текст "This message has been deleted"
    * Кнопка треда: рендерится в `Message.tsx` и остаётся видимой даже для удалённых корневых сообщений

## 11. Исправление отображения сырых Matrix ID вместо имен в сайдбаре
**Цель:** В списке комнат для некоторых сообщений вместо имени отправителя отображается его Matrix ID (например, @user:domain.com). Это происходит потому, что у объекта события в сайдбаре `event.sender` иногда не инициализирован.

* **Проблема:** Код `const senderName = evt.sender?.name || senderId?.split(':')[0];` при отсутствии `evt.sender?.name` падал в фоллбэк на сырой Matrix ID.

* **Решение:** В `src/app/hooks/useRoomLastMessage.ts` добавлена промежуточная проверка через `room.getMember()` перед использованием сырого ID.

* **Реализация:**
    ```typescript
    let senderName = evt.sender?.name;

    // Если имени нет или оно совпадает с сырым ID, ищем через комнату
    if (!senderName || senderName === senderId) {
      const member = room?.getMember(senderId);
      senderName = member?.name || senderId;
    }
    ```

* **Как это работает:**
    | Ситуация | Поведение |
    |----------|-----------|
    | `evt.sender?.name` существует | Используется имя из события |
    | `evt.sender?.name` отсутствует | Пытаемся найти через `room.getMember(senderId)` |
    | Нигде не найдено | Фоллбэк на `senderId` (сырой Matrix ID) |

* **Результат:** В сайдбаре теперь отображается корректное имя пользователя вместо `@user:domain.com` для всех сообщений, даже если объект события не полностью инициализирован.

## 12. Вставка гиперссылок в редакторе (Cmd+K / Ctrl+K) — как в Telegram
**Цель:** Добавить возможность вставки Markdown-ссылок через выделение текста + горячую клавишу Cmd+K (Ctrl+K), аналогично поведению в Telegram.

* **Переназначение Quick Search:**
    * **Файл:** `src/app/features/search/Search.tsx`
    * **Изменение:** Хоткей открытия быстрого поиска чатов изменен с `Cmd+K` на `Cmd+F`
    * **Код:** `if (isKeyHotkey('mod+f', event))`
    * **Причина:** Освободить `Cmd+K` для вставки ссылок, избежать конфликта с браузерным поиском

* **Новые файлы:**
    * `src/app/features/insert-link-dialog/InsertLinkDialog.tsx` — основной компонент модального окна
    * `src/app/features/insert-link-dialog/index.ts` — экспорты
    * `src/app/state/insertLinkDialog.ts` — Jotai atom для управления состоянием диалога
    * `src/app/state/hooks/insertLinkDialog.ts` — хуки `useOpenInsertLinkDialog`, `useCloseInsertLinkDialog`

* **Структура диалога InsertLinkDialog:**
    1.  **Заголовок:** "Вставить ссылку"
    2.  **Поле "Текст":** Текст ссылки (по умолчанию — выделенный текст из редактора)
    3.  **Поле "Ссылка":** URL (по умолчанию — ссылка из буфера обмена, если валидная)
    4.  **Кнопки:** "Добавить" (primary) + "Отмена" (secondary)
    5.  **Горячие клавиши:** `Enter` для вставки, `Escape` для закрытия

* **Переиспользование существующего UI:**
    * Скопирована структура из `ForwardDialog.tsx`
    * Стандартные компоненты из библиотеки `folds`: `Modal`, `Overlay`, `Header`, `Input`, `Button`, `Text`
    * FocusTrap для корректного управления фокусом внутри модалки

* **Интеграция в поле ввода (Message Input):**
    * **Файл:** `src/app/features/room/RoomInput.tsx`
    * **Обработчик:** Добавлен в `handleKeyDown` проверку `isKeyHotkey('mod+k', evt)`
    * **Логика получения данных:**
        1.  Получает выделенный текст из Slate editor через `Node.string()` + slice по offset
        2.  Пытается прочитать буфер обмена через `navigator.clipboard.readText()`
        3.  Проверяет валидность URL: `/^https?:\/\//.test(clipboardText.trim())`
        4.  Открывает диалог с предзаполненными значениями
    * **Обработка ошибок буфера:** Если доступ к clipboard запрещен, диалог всё равно открывается (просто без URL по умолчанию)

* **Вставка Markdown:**
    * **Формат:** `[Текст](URL)` — стандартный Markdown
    * **Если текст пустой:** Используется URL как отображаемый текст: `[URL](URL)`
    * **Замена выделения:** `Transforms.delete(editor)` + `Transforms.insertText(editor, markdownLink)`
    * **Вставка в позицию курсора:** Если текст не выделен, вставляет по текущей позиции
    * **Возврат фокуса:** `ReactEditor.focus(editor)` после вставки

* **Глобальное подключение:**
    * `InsertLinkDialogRenderer` добавлен в `Router.tsx` рядом с другими глобальными модальными окнами
    * Управление через Jotai atom: `useOpenInsertLinkDialog({ initialText, initialUrl, onInsert })`

* **Как это работает (пользовательский сценарий):**
    1.  Пользователь выделяет текст в поле ввода
    2.  Нажимает `Cmd+K` (или `Ctrl+K`)
    3.  Открывается диалог с предзаполненным текстом и URL из буфера
    4.  Редактирует поля при необходимости
    5.  Нажимает "Добавить" или `Enter`
    6.  Markdown-ссылка `[Текст](URL)` вставляется на место выделения
    7.  Фокус возвращается в редактор

* **Примечания:**
    * Поддержка как `Cmd+K` (macOS), так и `Ctrl+K` (Windows/Linux) через `isKeyHotkey('mod+k', evt)`
    * Slate editor требует использования `Node.string()` вместо `Range.text` (не существует в Slate)
    * Fallback-логика для получения выделенного текста через `editor.fragment(selection)`

## 13. Исправление отправки файлов в треды — файлы падали в корень комнаты
**Цель:** Файлы (изображения, видео, аудио, документы), отправленные из UI треда, должны привязываться к треду, а не улетать в корень комнаты.

* **Проблема:** При отправке текстового сообщения из треда к нему корректно добавлялся `m.relates_to` с `rel_type: 'm.thread'`. Однако пайплайн отправки файлов формировал `m.room.message` (msgtype: `"m.image"`) без `m.relates_to`, из-за чего файл появлялся в корневом чате комнаты.

* **Решение:** В функцию `handleSendUpload` в `RoomInput.tsx` добавлена логика формирования `m.relates_to`, идентичная логике отправки текста:
    * Если активен `replyDraft` с thread-отношением → полная thread-привязка (`is_falling_back: false`)
    * Если активен `activeThread` (пользователь просматривает тред) → автоматическая thread-привязка (`is_falling_back: true`)

* **Реализация (`src/app/features/room/RoomInput.tsx`):**
    ```typescript
    // В handleSendUpload, после формирования content файла:
    if (replyDraft) {
      content['m.relates_to'] = { 'm.in_reply_to': { event_id: replyDraft.eventId } };
      if (replyDraft.relation?.rel_type === RelationType.Thread) {
        content['m.relates_to'].event_id = replyDraft.relation.event_id;
        content['m.relates_to'].rel_type = RelationType.Thread;
        content['m.relates_to'].is_falling_back = false;
      }
    } else if (activeThread) {
      content['m.relates_to'] = {
        rel_type: RelationType.Thread,
        event_id: activeThread,
        is_falling_back: true,
      };
    }
    ```

* **Как это работает:**
    | Ситуация | Поведение |
    |----------|-----------|
    | Отправка файла в открытом треде | Файл привязывается к треду (`is_falling_back: true`) |
    | Reply in Thread + файл | Файл привязывается к треду через replyDraft (`is_falling_back: false`) |
    | Ответ на сообщение (без треда) | Файл получает `m.in_reply_to` |
    | Обычная отправка (не тред) | Без `m.relates_to` (как раньше) |

* **Поддерживаемые типы файлов:** `m.image`, `m.video`, `m.audio`, `m.file` — все типы файлов теперь корректно привязываются к треду.

## 14. Восстановление Local Echo (мгновенного отображения) для сообщений и файлов в тредах
**Цель:** Сообщения и файлы, отправленные в тред, должны мгновенно появляться в UI треда с анимацией отправки (Local Echo), без необходимости перезагрузки страницы.

* **Проблема 1 (SDK-уровень):** `mx.sendMessage(roomId, content)` без указания `threadId` отправлял сообщение корректно, но SDK не мог маршрутизировать Local Echo в объект Thread — событие попадало в общий таймлайн комнаты, а не в таймлайн треда.

* **Проблема 2 (UI-уровень):** Компонент `ThreadTimeline` не имел подписки на события комнаты (`RoomEvent.Timeline`, `RoomEvent.LocalEchoUpdated`) и не перерисовывался при появлении новых событий. В отличие от `RoomTimeline`, который слушал эти события и обновлял диапазон рендеринга.

* **Решение (2 части):**

    **Часть A — SDK-уровень (`RoomInput.tsx`):** Передача `threadId` вторым параметром в `mx.sendMessage()`:
    ```typescript
    // Определение threadId для локального эха
    const threadId = replyDraft?.relation?.rel_type === RelationType.Thread
      ? replyDraft.relation.event_id
      : activeThread;

    // Отправка с правильным threadId
    if (threadId) {
      mx.sendMessage(roomId, threadId, content);
    } else {
      mx.sendMessage(roomId, content);
    }
    ```
    Применено в обеих функциях отправки: `handleSendUpload` (файлы) и `submit` (текст).

    **Часть B — UI-уровень (`ThreadTimeline.tsx`):** Добавлены подписки на события комнаты, аналогично `RoomTimeline`:
    ```typescript
    // Подписка на новые события (включая локальные эхо)
    room.on(RoomEvent.Timeline, handleTimelineEvent);
    // Подписка на замену локального ID на серверный
    room.on(RoomEvent.LocalEchoUpdated, handleLocalEchoUpdated);
    ```

    Фильтрация событий: компонент реагирует только на события, относящиеся к текущему треду (`relation.rel_type === 'm.thread' && relation.event_id === rootEventId`).

* **Реализация (`src/app/features/room/ThreadTimeline.tsx`):**
    * Добавлен `useState` счётчик для принудительного ре-рендера при поступлении событий
    * Добавлен `useCallback` для фильтрации событий по принадлежности к треду
    * Добавлен `useEffect` с подпиской на `RoomEvent.Timeline` и `RoomEvent.LocalEchoUpdated`
    * Корректная очистка слушателей при размонтировании компонента

* **Как это работает:**
    | Этап | Что происходит |
    |------|----------------|
    | 1. Пользователь отправляет сообщение/файл | SDK создаёт Local Echo с временным ID |
    | 2. `RoomEvent.Timeline` срабатывает | `ThreadTimeline` фильтрует → ре-рендер → сообщение появляется мгновенно |
    | 3. Сервер подтверждает получение | `RoomEvent.LocalEchoUpdated` — временный ID заменяется на серверный |
    | 4. `ThreadTimeline` обновляется | Отображение с серверным ID, анимация "отправлено" |
    | 5. Ошибка отправки | Local Echo обновляется статусом ошибки |

* **Файлы:**
    * `src/app/features/room/RoomInput.tsx` — передача `threadId` в `sendMessage()`
    * `src/app/features/room/ThreadTimeline.tsx` — подписки на `RoomEvent.Timeline` и `RoomEvent.LocalEchoUpdated`

* **Примечания:**
    * matrix-js-sdk v38.2.0 поддерживает сигнатуру `sendMessage(roomId, threadId, content)` из коробки
    * При `PendingEventOrdering.Chronological` (по умолчанию) локальные эхо автоматически вставляются в live-таймлайн комнаты
    * `threadRootId` на событиях локального эха устанавливается корректно благодаря передаче `threadId` в SDK


