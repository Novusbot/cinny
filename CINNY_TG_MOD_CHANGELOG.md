***

# Документация модификаций: Cinny Telegram Edition

Данный документ описывает кастомные изменения, внесенные в исходный код клиента Cinny для адаптации UI/UX под паттерны мессенджера Telegram.

## 1. Нативная навигация и жесты (macOS) — УМНАЯ иерархическая навигация (State-based)
**Цель:** Добавить поддержку свайпов с Magic Mouse / трекпада и горячих клавиш для управления комнатами, тредами и модальными окнами с соблюдением Z-индекса интерфейса. Использовать декларативное состояние вместо императивных DOM-проверок.

* **Глобальная навигация с приоритетами (Назад / ESC / Свайп):**
    * **Файлы:** `src/app/features/room/Room.tsx`, `src/app/hooks/useMacNavigation.ts`
    * **Новые файлы:**
        * `src/app/state/navigationStack.ts` — Jotai атомы для централизованного учета открытых модалок
        * `src/app/hooks/useDialogStack.ts` — хук для регистрации/снятия модалок в стеке навигации
    * **Архитектура:** Переход от **императивных DOM-проверок** (`document.querySelector`) к **декларативному управлению состоянием** (Jotai atoms)
    * **Реализация:** Внедрена **умная иерархическая навигация** с 3 уровнями приоритета:
        1.  **Приоритет 1 (Модальные окна):** Проверка через Jotai атом `hasOpenDialogsAtom`. Модалки сами регистрируются при маунте через `useDialogStack().mount()` и снимаются при анмаунте. Никаких гонок состояний!
        2.  **Приоритет 2 (Треды):** Если модалок нет (`activeDialogsCount === 0`), но открыт тред — закрывает тред
        3.  **Приоритет 3 (Комната):** Если нет модалок и тредов — закрывает комнату (навигация домой)
    * **Остановка всплытия ESC:** Все модалки обязаны вызывать `evt.stopPropagation()` + `evt.nativeEvent.stopImmediatePropagation()` в обработчиках ESC. Это предотвращает двойное закрытие (модалка + тред/комната) от одного нажатия
    * **Обработка свайпов:** `useMacNavigation` читает `hasOpenDialogs` из Jotai. При `true` — диспатчит событие Escape, которое перехватывается FocusTrap модалки
    * **Обработка ESC:** `useKeyDown` в Room.tsx читает `hasOpenDialogs` из Jotai. При `true` — просто возвращает управление (модалка закроется своим обработчиком)

* **Как это работает:**
    | Ситуация | Поведение свайпа/ESC |
    |----------|---------------------|
    | Открыт InsertLinkDialog/ForwardDialog | Закрывает модалку, НЕ закрывает тред/комнату |
    | Открыт тред (без модалок) | Закрывает тред, НЕ закрывает комнату |
    | Нет открытых элементов | Закрывает комнату → домой |

* **Интеграция новых модалок:**
    ```typescript
    import { useDialogStack } from '../../hooks/useDialogStack';

    export function MyNewDialog() {
      const dialogStack = useDialogStack();
      
      useEffect(() => {
        dialogStack.mount();
        return () => dialogStack.unmount();
      }, [dialogStack]);
      
      // ... rest of component
    }
    ```

* **Документация:** 
    * `src/app/state/navigationStack.ts` — атомы `activeDialogsCountAtom` и `hasOpenDialogsAtom`
    * `src/app/hooks/useDialogStack.ts` — хуки `useDialogStack()`, `useHasOpenDialogs()`, `useActiveDialogsCount()`


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

* **Перехват жестов навигации (УМНАЯ навигация, State-based):**
    * **Файлы:** `src/app/features/room/Room.tsx`, `src/app/hooks/useMacNavigation.ts`, `src/app/state/navigationStack.ts`, `src/app/hooks/useDialogStack.ts`
    * **Реализована иерархическая навигация с 3 уровнями приоритета:**
        1.  **Модальные окна:** Проверка через `hasOpenDialogsAtom` (Jotai) → модалка закрывается своим обработчиком
        2.  **Треды:** Проверка `activeThread` → закрытие через `setActiveThread(null)`
        3.  **Комнаты:** Навигация домой через `navigate(getHomePath())`
    * `useMacNavigation` принимает callback `onSwipeRight` для перехвата жеста (закрытие треда)
    * Свайп и ESC **НЕ закрывают** тред или комнату, если открыты модальные окна
    * **Архитектура:** Модалки регистрируются в глобальном стеке через `useDialogStack().mount()` при маунте и снимаются при анмаунте
    * **Документация:** Подробнее в разделе 1 (Нативная навигация — УМНАЯ иерархическая навигация State-based)

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
        1.  Получает выделенный текст из Slate editor через `Editor.string(editor, selection)` — корректно извлекает текст из многострочных сообщений
        2.  Пытается прочитать буфер обмена (Tauri API для десктопа или Web API для браузера)
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
    * **Исправление:** Используется `Editor.string(editor, selection)` вместо `Node.string()` — это корректно извлекает выделенный текст в многострочных сообщениях
    * Tauri clipboard plugin для десктопа (`@tauri-apps/plugin-clipboard-manager`) + fallback на Web API для браузера

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

## 15. Исправление некорректного получения выделенного текста в Slate.js при нажатии Cmd+K
**Цель:** Исправить ошибку извлечения выделенного текста в многострочных сообщениях при использовании Cmd+K для вставки ссылок.

* **Проблема:** При выделении текста на второй или третьей строке многострочного сообщения, скрипт захватывал текст из первой строки. Это происходило из-за неправильного использования `Node.string()` и ручного slice по offset.

* **Причина ошибки:** 
    * `Node.string(editor)` возвращает весь текст из всех узлов редактора
    * `selection.anchor.offset` и `selection.focus.offset` относительны к конкретному текстовому узлу (leaf), а не ко всему документу
    * Ручной slice по этим offset приводил к извлечению текста из неправильной позиции

* **Решение:** Замена ручного извлечения на встроенный метод `Editor.string()` из Slate:

* **Реализация (`src/app/features/room/RoomInput.tsx`):**
    ```typescript
    // БЫЛО (некорректно):
    selectedText = (Node.string(editor) || '').slice(selection.anchor.offset, selection.focus.offset);
    
    // СТАЛО (корректно):
    selectedText = Editor.string(editor, selection);
    ```

* **Как это работает:**
    | Метод | Поведение |
    |-------|-----------|
    | `Node.string(editor).slice()` | Возвращает неправильный текст (из первой строки) |
    | `Editor.string(editor, selection)` | Slate сам проходит по всем узлам и возвращает точный выделенный текст |

* **Результат:** Теперь при выделении текста в любой строке многострочного сообщения и нажатии Cmd+K, в диалог вставки ссылки подставляется правильный выделенный текст.

* **Файлы:**
    * `src/app/features/room/RoomInput.tsx` — исправлена логика получения выделенного текста

## 16. Рефакторинг глобальной навигации — переход от DOM-проверок к State Management (Jotai)
**Цель:** Устранить гонки состояний и проблемы с всплытием событий при использовании императивных DOM-проверок (`document.querySelector`). Перейти на декларативное управление состоянием модалок через Jotai atoms.

* **Проблема старой реализации:**
    * `hasOpenDialog()` использовала `document.querySelector(...)` для поиска открытых модалок
    * Это приводило к гонкам состояний: состояние React обновляется, но DOM ещё не обновился
    * ESC событие всплывало от модалки до `Room.tsx` → двойное закрытие (модалка + тред)
    * Селекторы могли не найти модалку, если она рендерится в Portal с задержкой

* **Решение (State-based архитектура):**

    **Часть A — Создание глобального стека навигации (`src/app/state/navigationStack.ts`):**
    ```typescript
    // Атом-счетчик: сколько модалок сейчас открыто
    export const activeDialogsCountAtom = atom(0);
    
    // Производный атом: true если есть хотя бы одна открытая модалка
    export const hasOpenDialogsAtom = atom((get) => get(activeDialogsCountAtom) > 0);
    ```

    **Часть B — Хук для регистрации модалок (`src/app/hooks/useDialogStack.ts`):**
    ```typescript
    export function useDialogStack() {
      const setCount = useSetAtom(activeDialogsCountAtom);
      
      const mount = useCallback(() => {
        setCount((prev) => prev + 1);  // Регистрируем модалку
      }, [setCount]);
      
      const unmount = useCallback(() => {
        setCount((prev) => Math.max(0, prev - 1));  // Снимаем модалку
      }, [setCount]);
      
      return { mount, unmount };
    }
    ```

    **Часть C — Интеграция в InsertLinkDialog:**
    ```typescript
    export function InsertLinkDialog() {
      const dialogStack = useDialogStack();
      
      // Регистрация в стеке навигации
      useEffect(() => {
        dialogStack.mount();
        return () => dialogStack.unmount();
      }, [dialogStack]);
      
      // ... rest of component
    }
    ```

    **Часть D — Обновление обработчиков навигации:**
    
    *`useMacNavigation.ts` (свайпы):*
    ```typescript
    const hasOpenDialogs = useAtomValue(hasOpenDialogsAtom);  // Читаем из Jotai
    
    const handleWheel = useCallback((event: WheelEvent) => {
      if (hasOpenDialogs) {
        // Диспатчим Escape — модалка закроется своим обработчиком
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', ... }));
        return; // Не закрываем тред/комнату
      }
      // ... thread/room logic
    }, [hasOpenDialogs]);
    ```
    
    *`Room.tsx` (ESC):*
    ```typescript
    const hasOpenDialogs = useAtomValue(hasOpenDialogsAtom);  // Читаем из Jotai
    
    useKeyDown(window, useCallback((evt) => {
      if (isKeyHotkey('escape', evt)) {
        if (hasOpenDialogs) {
          return; // Модалка закроется своим обработчиком (stopPropagation)
        }
        // ... thread/room logic
      }
    }, [hasOpenDialogs]));
    ```

    **Часть E — Остановка всплытия ESC в модалках:**
    ```typescript
    // InsertLinkDialog.tsx
    const handleKeyDown = (evt) => {
      if (isKeyHotkey('escape', evt)) {
        evt.stopPropagation();  // Блокируем всплытие до window
        evt.nativeEvent.stopImmediatePropagation();  // Жесткая блокировка
        handleRequestClose();
      }
    };
    ```

* **Как это работает:**
    | Этап | Что происходит |
    |------|----------------|
    | 1. Модалка открывается | React рендерит компонент InsertLinkDialog |
    | 2. `useEffect` маунта | Вызывает `dialogStack.mount()` → `activeDialogsCountAtom: 0 → 1` |
    | 3. Пользователь нажимает ESC | `Room.tsx` читает `hasOpenDialogsAtom` → `true` |
    | 4. Проверка приоритета | `if (hasOpenDialogs) return;` — Room.tsx НЕ закрывает тред |
    | 5. ESC перехватывается модалкой | `handleKeyDown` с `stopPropagation()` |
    | 6. Модалка закрывается | Вызывает `closeDialog()` → atom = `undefined` |
    | 7. `useEffect` анмаунта | Вызывает `dialogStack.unmount()` → `activeDialogsCountAtom: 1 → 0` |
    | 8. Состояние обновлено | Навигация снова может закрывать тред/комнату |

* **Архитектурные преимущества:**
    * **Без гонок состояний:** Jotai атом обновляется синхронно с React рендером
    * **Без DOM-хаков:** Никаких `querySelector`, `role="dialog"`, проверок классов
    * **Строгая типизация:** TypeScript контролирует всё, нет loose селекторов
    * **Расширяемость:** Новая модалка = 3 строки кода (`useDialogStack()`)
    * **Предсказуемость:** Единый источник правды для всех обработчиков навигации

* **Удаленные файлы:**
    * `src/app/utils/dialog.ts` — больше не нужен (заменен на `navigationStack.ts`)

* **Файлы:**
    * `src/app/state/navigationStack.ts` — **НОВЫЙ** атомы `activeDialogsCountAtom`, `hasOpenDialogsAtom`
    * `src/app/hooks/useDialogStack.ts` — **НОВЫЙ** хуки `useDialogStack()`, `useHasOpenDialogs()`
    * `src/app/features/insert-link-dialog/InsertLinkDialog.tsx` — интеграция `useDialogStack()`, `stopPropagation()`
    * `src/app/hooks/useMacNavigation.ts` — читает `hasOpenDialogs` из Jotai вместо DOM
    * `src/app/features/room/Room.tsx` — читает `hasOpenDialogs` из Jotai вместо DOM

## 17. Исправление парсера Markdown для ссылок с круглыми скобками
**Цель:** Поддержка URL-адресов, содержащих вложенные круглые скобки (например, ссылки на CRM-системы), при рендеринге Markdown-ссылок.

* **Проблема:** Встроенный кастомный парсер Markdown в Cinny использовал регулярное выражение, которое обрывало URL на первой попавшейся закрывающей круглой скобке `)`. Из-за этого ссылки вида `[текст](https://domain.com/path(param))` ломались при рендеринге и отправке сообщения в Matrix.
* **Решение:** Обновлено регулярное выражение `LINK_URL` для поддержки вложенности круглых скобок.
* **Реализация (`src/app/plugins/markdown/inline/rules.ts`):**
    ```typescript
    // Было:
    // const LINK_URL = `\\((https?:\\/\\/.+?)\\)`;

    // Стало:
    const LINK_URL = `\\((https?:\\/\\/(?:[^)(]+|\\([^)(]*\\))*)\\)`;
    ```
    Теперь парсер корректно захватывает символы внутри ссылок и поддерживает один уровень вложенности `\([^)(]*\)`, формируя правильный `href` без визуального мусора.


