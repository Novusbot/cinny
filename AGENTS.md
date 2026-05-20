# AGENTS.md — Cinny Telegram Edition

> Документ для AI-агентов и разработчиков, работающих с форком Cinny (Telegram Edition).
> Содержит архитектуру, правила мержа, сборки и специфику кастомных модификаций.

---

## 1. Обзор проекта

Это **форк** клиента [Cinny](https://github.com/cinnyapp/cinny) (Matrix-клиент на React).
В форк внесены UI/UX модификации под паттерны Telegram — так называемая **Cinny Telegram Edition**.

Полный список изменений documented в:
- `/Users/spikalov/Проекты/Matrix/cinny/CINNY_TG_MOD_CHANGELOG.md`

---

## 2. Структура репозиториев

Проект состоит из **двух связанных репозиториев**:

| Репозиторий | Тип | Назначение | Ветка | Origin | Upstream |
|---|---|---|---|---|---|
| `cinny` | Веб-приложение (React + Vite) | UI/UX, логика чатов, треды | `dev` | `Novusbot/cinny` | `cinnyapp/cinny` |
| `cinny-desktop` | Tauri 2.x обертка (Rust) | Десктопное приложение | `dev` | `Novusbot/cinny-desktop` | `cinnyapp/cinny-desktop` |

### Связь между репозиториями

`cinny-desktop/cinny` — это **symlink** на `../cinny`:
```bash
cd /Users/spikalov/Проекты/Matrix/cinny-desktop
ln -s ../cinny cinny
```

**Критически важно:** это НЕ git submodule. В `cinny-desktop` папка `cinny` добавлена в `.gitignore`.

---

## 3. Кастомные модификации (Telegram Edition)

Ключевые изменения, которые **нельзя потерть** при мерже:

### Навигация и UX
- **Нативная навигация macOS** — свайпы Magic Mouse / трекпада, ESC с приоритетами (модалки → треды → комната)
- **Умная иерархическая навигация** — декларативное состояние через Jotai (`navigationStack.ts`, `useDialogStack.ts`)
- **Треды как в Element** — скрытие ответов из главной ленты, кнопка "X replies", ThreadTimeline

### UI Telegram-стиля
- **Единая лента чатов** — все комнаты на вкладке Home (без фильтрации orphan)
- **DM + Rooms вместе** — личные сообщения над группами на Home
- **Telegram-стиль превью** — аватарки отправителей, "Вы:", двустрочный текст, таймстамп справа
- **Визуальные разделители** — линии между чатами (`RoomTile` с `::after`)
- **Форматирование времени** — `formatTime.ts` (Сегодня/Вчера/День недели/Дата)

### Функциональность
- **Forward Dialog** — пересылка сообщений в другие чаты (Jotai + `folds` UI)
- **Insert Link Dialog** — Cmd+K / Ctrl+K для вставки Markdown-ссылок (`[text](url)`)
- **Отправка файлов в треды** — фикс привязки `m.relates_to` для файлов
- **Local Echo в тредах** — мгновенное отображение сообщений через `threadId` в `sendMessage()`

### Багфиксы
- Сохранение тредов при удалении корневого сообщения (redacted thread root)
- Исправление сырых Matrix ID в сайдбаре (`useRoomLastMessage.ts`)
- Исправление парсера Markdown для ссылок со скобками (`inline/rules.ts`)

---

## 4. Сборка и запуск

### Веб (cinny)
```bash
cd /Users/spikalov/Проекты/Matrix/cinny
npm start        # dev сервер localhost:8080
npm run build    # production → cinny/dist/
```

### Десктоп (cinny-desktop)
```bash
cd /Users/spikalov/Проекты/Matrix/cinny-desktop
npm run tauri build     # production сборка приложения
npm run tauri dev       # dev режим (запускает cinny + Tauri)
```

**Важно:** `tauri.conf.json` содержит:
- `beforeBuildCommand: "cd cinny && npm run build"` — веб собирается автоматически перед десктопом
- `beforeDevCommand: "cd cinny && npm start"` — HMR в dev режиме
- `frontendDist: "../cinny/dist"` — берет собранные ассеты из веба

---

## 5. Управление версиями

Версия должна быть **СИНХРОНИЗИРОВАНА** в трех местах:

1. **`cinny/package.json`** — источник правды для веба
2. **`cinny-desktop/src-tauri/Cargo.toml`** → `version = "X.Y.Z"`
3. **`cinny-desktop/src-tauri/tauri.conf.json`** → `"version": "X.Y.Z"`

**Правило:** Версия веба (`cinny/package.json`) задает версию релиза. Десктопные файлы приравниваются к ней.

---

## 6. Синхронизация с upstream (Git workflow)

### Общий порядок обновления
1. Обновить `cinny` от upstream
2. Обновить `cinny-desktop` от upstream
3. Разрешить конфликты (см. раздел 7)
4. Синхронизировать версии (раздел 5)
5. Собрать и протестировать
6. Запушить оба репозитория

### cinny (веб)
```bash
cd /Users/spikalov/Проекты/Matrix/cinny
git fetch upstream
git merge upstream/dev    # или upstream/main, смотря что у официалов
# разрешить конфликты
git push origin dev
```

### cinny-desktop (Tauri)
```bash
cd /Users/spikalov/Проекты/Matrix/cinny-desktop
git fetch upstream
git merge upstream/main   # upstream-desktop всегда main
# разрешить конфликты
git push origin dev
```

---

## 7. Разрешение типичных конфликтов

### 7.1 cinny-desktop: Tauri Rust-файлы

#### `src-tauri/src/lib.rs`
**Паттерн конфликта:** upstream удаляет или добавляет плагины.

**Решение:**
- Сохранить **все наши плагины**:
  ```rust
  .plugin(tauri_plugin_fs::init())
  .plugin(tauri_plugin_dialog::init())
  .plugin(tauri_plugin_notification::init())
  .plugin(tauri_plugin_clipboard_manager::init())
  .plugin(tauri_plugin_shell::init())
  .plugin(tauri_plugin_http::init())
  .plugin(tauri_plugin_process::init())
  .plugin(tauri_plugin_os::init())
  ```
- Принять **новые upstream-фичи** (например, `on_new_window`, `OpenerExt`, `NewWindowResponse`)
- Комментарии на русском можно оставить — они не мешают

#### `src-tauri/Cargo.toml`
- Взять upstream-версии Tauri и плагинов
- Убедиться что все наши зависимости-плагины на месте

#### `src-tauri/Cargo.lock`
**Решение:**
```bash
cd /Users/spikalov/Проекты/Matrix/cinny-desktop/src-tauri
cargo update
```
Лучше принять upstream-версию, затем запустить `cargo update` чтобы подтянуть наши плагины.

#### `src-tauri/tauri.conf.json`
- Принять upstream-изменения в `security.csp`, `capabilities`, `build`
- Проверить и обновить поле `"version"`
- Сохранить наши иконки и bundle-настройки

### 7.2 cinny: Веб-компоненты

#### `src/app/features/room-nav/RoomNavItem.tsx`
**Паттерн:** upstream добавляет импорты (`RoomIcon`, `getStateEvent`, `StateEvent`, `webRTCSupported`).

**Решение:**
- Принять ВСЕ новые импорты из upstream
- **Сохранить нашу верстку** Telegram-стиля:
  - Правая колонка с таймстампом
  - Аватарки отправителей (16x16px)
  - Префикс "Вы:" и имена
  - Разделители и отступы
- Удалить **дублирующиеся** upstream-бейджи, если они появляются вне нашей структуры

#### `src/app/features/room/Room.tsx`
**Паттерн:** upstream добавляет call-хуки (`useCallEmbed`, `useCallMembers`, `useCallSession`).

**Решение:**
- Сохранить наши импорты навигации: `useMacNavigation`, `useActiveThread`, `useSetActiveThread`, `hasOpenDialogsAtom`
- Добавить новые call-импорты из upstream
- Вся логика `useKeyDown` (ESC с приоритетами) и `useMacNavigation` — **наша**, сохранить целиком

#### `src/app/features/room/RoomViewHeader.tsx`
**Паттерн:** upstream добавляет call-фичи (`CallButton`), HEAD добавляет треды.

**Решение:**
- Сохранить импорты тредов: `useActiveThread`, `useSetActiveThread`
- Добавить call-импорты из upstream: `useCallEmbed`, `useCallStart`, `useLivekitSupport`, `webRTCSupported`
- Сохранить логику отображения треда в шапке ("Тред: {name}", кнопка назад)

### 7.3 Критическое правило: cinny symlink

**НИКОГДА** не допускать коммита папки `cinny` внутрь `cinny-desktop`.

Если git ругается на submodule:
```bash
cd /Users/spikalov/Проекты/Matrix/cinny-desktop
git submodule deinit -f cinny 2>/dev/null || true
rm -rf .git/modules/cinny
rm -f .gitmodules
git rm --cached cinny 2>/dev/null || true
rm -rf cinny
ln -s ../cinny cinny
echo "/cinny" >> .gitignore
git add .gitignore
```

---

## 8. Git конфигурация

### cinny
```bash
origin  https://github.com/Novusbot/cinny.git (fetch/push)
upstream https://github.com/cinnyapp/cinny.git (fetch/push)
branch: dev
```

### cinny-desktop
```bash
origin  https://github.com/Novusbot/cinny-desktop.git (fetch/push)
upstream https://github.com/cinnyapp/cinny-desktop.git (fetch/push)
branch: dev (default branch на GitHub)
```

**Важно:** upstream веба может быть `dev` или `main` — проверять перед мержем.
Upstream десктопа всегда `main`.

---

## 9. Файлы, требующие особого внимания

Эти файлы содержат кастомную логику и почти всегда конфликтуют при мерже:

### Навигация и треды
- `src/app/features/room/Room.tsx`
- `src/app/features/room/RoomViewHeader.tsx`
- `src/app/features/room/RoomView.tsx`
- `src/app/features/room/RoomTimeline.tsx`
- `src/app/features/room/ThreadTimeline.tsx`
- `src/app/features/room/RoomInput.tsx`
- `src/app/hooks/useMacNavigation.ts`
- `src/app/state/navigationStack.ts`
- `src/app/state/hooks/activeThread.ts`
- `src/app/hooks/useDialogStack.ts`

### Telegram UI
- `src/app/features/room-nav/RoomNavItem.tsx`
- `src/app/hooks/useRoomLastMessage.ts`
- `src/app/hooks/useHomeRooms.ts`
- `src/app/utils/formatTime.ts`
- `src/app/features/room-nav/styles.css.ts`

### Фичи
- `src/app/features/forward-dialog/` (вся папка)
- `src/app/features/insert-link-dialog/` (вся папка)
- `src/app/state/forwardDialog.ts`
- `src/app/state/insertLinkDialog.ts`
- `src/app/state/hooks/forwardDialog.ts`
- `src/app/state/hooks/insertLinkDialog.ts`

### Поиск и коммуникации
- `src/app/features/search/Search.tsx` (переназначен hotkey с Cmd+K на Cmd+F)
- `src/app/plugins/markdown/inline/rules.ts` (regex для ссылок со скобками)

### Конфигурация
- `config.json` (homeservers, featured communities) — **наш**, не перезаписывать upstream

---

## 10. Чеклист перед релизом

- [ ] Обновить `cinny` от upstream, разрешить конфликты, запушить `dev`
- [ ] Обновить `cinny-desktop` от upstream, разрешить конфликты, запушить `dev`
- [ ] Синхронизировать версию в 3 местах (package.json, Cargo.toml, tauri.conf.json)
- [ ] Убедиться что symlink `cinny-desktop/cinny` жив (`ls -la cinny-desktop/cinny`)
- [ ] Проверить отсутствие `.gitmodules` в `cinny-desktop`
- [ ] `cargo update` в `cinny-desktop/src-tauri/`
- [ ] Собрать веб: `cd cinny && npm run build`
- [ ] Собрать десктоп: `cd cinny-desktop && npm run tauri build`
- [ ] Протестировать:
  - [ ] Навигация (ESC, свайпы, модалки)
  - [ ] Треды (открытие, отправка, файлы)
  - [ ] Звонки (CallButton, CallView)
  - [ ] Forward сообщений
  - [ ] Вставка ссылок (Cmd+K)
  - [ ] Отображение превью в сайдбаре

---

## 11. Частые ошибки и решения

### "error: expected submodule path 'cinny' not to be a symbolic link"
**Причина:** git ожидает submodule, а нашёл symlink.
**Решение:** Раздел 7.3 — удалить submodule-tracking, восстановить symlink, добавить в `.gitignore`.

### "failed to run custom build command for `app-lib`"
**Причина:** `Cargo.lock` рассинхронизирован с `Cargo.toml`.
**Решение:** `cd src-tauri && cargo update`.

### Версия десктопа отличается от веба
**Причина:** Забыли обновить одно из трех мест.
**Решение:** Синхронизировать `package.json` → `Cargo.toml` → `tauri.conf.json`.

### Конфликты в `src-tauri/gen/schemas/*`
**Решение:** Это auto-generated файлы. Принять upstream-версию, они перегенерируются при сборке.

---

## 12. Контакты и источники

- **Полный changelog:** `/Users/spikalov/Проекты/Matrix/cinny/CINNY_TG_MOD_CHANGELOG.md`
- **Upstream веб:** https://github.com/cinnyapp/cinny
- **Upstream десктоп:** https://github.com/cinnyapp/cinny-desktop
- **Fork веб:** https://github.com/Novusbot/cinny
- **Fork десктоп:** https://github.com/Novusbot/cinny-desktop
