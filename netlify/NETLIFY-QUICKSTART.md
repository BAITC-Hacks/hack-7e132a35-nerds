# Развёртывание на Netlify

## 1. Подготовьте PostgreSQL

Создайте базу PostgreSQL у провайдера. В Supabase откройте **SQL Editor → New query**, вставьте содержимое `db/001_auth.sql` из проекта и нажмите **Run**. Это создаст три таблицы для пользователей, сессий и лимитов входа.

Для пароля приложения создайте отдельную роль PostgreSQL. В Supabase SQL Editor откройте новый запрос, замените значение пароля на случайные 32 буквы/цифры и запустите один раз:

```sql
CREATE ROLE akim_app LOGIN PASSWORD 'ВСТАВЬТЕ_СЮДА_СЛУЧАЙНЫЙ_32_СИМВОЛЬНЫЙ_ПАРОЛЬ'
  NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE postgres TO akim_app;
GRANT USAGE ON SCHEMA public TO akim_app;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.users, public.sessions, public.auth_limits
  TO akim_app;
```

После этого откройте **Connect** в панели Supabase и выберите **Transaction pooler**. Скопируйте строку подключения: используйте адрес и порт `6543`, базу `postgres` и имя пользователя формата `akim_app.ВАШ_PROJECT_REF`. Вставьте созданный пароль вместо пароля в строке. Строка должна использовать SSL (`sslmode=require`). Для Netlify используйте внешний адрес из Connect. `localhost`, `127.0.0.1` и Docker-имя `db` здесь недоступны. Transaction pooler рекомендован для serverless; доступность прямого соединения зависит от IPv4/IPv6 вашей среды. Если пароль содержит символы кроме букв и цифр, их нужно URL-кодировать; проще сгенерировать 32 буквенно-цифровых символа.

## 2. Подключите проект к Netlify

Если хотите сохранить текущий адрес сайта, откройте его настройки Netlify и подключите GitHub в **Project configuration → Developer settings → Continuous deployment → Repository → Link to repository**. Если создаёте отдельный сайт, выберите **Add new project → Import an existing project**. В обоих случаях укажите корень проекта, где находятся `package.json`, `pnpm-lock.yaml` и `netlify.toml`.

Настройки сборки:

- Build command: `pnpm build`
- Publish directory: `.next`
- Base directory: папка с `package.json` и `netlify.toml`; пустая только если приложение лежит в корне репозитория.
- Node.js: 24; pnpm: 11.19.0 (зафиксирован в package.json).
- `PNPM_FLAGS=--shamefully-hoist` задан в netlify.toml.

Netlify собирает Next.js-приложение и обрабатывает серверные маршруты через Next.js runtime/OpenNext. Не загружайте эту папку через Netlify Drop как готовый статический сайт: API авторизации и симулятор требуют серверных функций.

## 3. Добавьте переменные окружения

Откройте **Project configuration → Environment variables**. Добавьте значения для Production:

| Имя | Значение |
|---|---|
| `DATABASE_URL` | Строка Supabase Transaction pooler с ролью `akim_app`, портом `6543` и SSL. Секретное значение, только серверная среда. |
| `APP_ORIGIN` | Точный адрес сайта, например `https://ваш-проект.netlify.app` — без завершающего `/`. |
| `ALLOW_REGISTRATION` | `true`, чтобы участники могли создавать аккаунты. |
| `SESSION_HOURS` | `12` |
| `PG_POOL_MAX` | `1` |

Добавляйте эти переменные в Netlify UI, не в `netlify.toml` и не в GitHub. Если Netlify показывает настройку **Scopes**, для переменных должен быть включён доступ к **Functions**. Не добавляйте секреты в `NEXT_PUBLIC_*`, исходный код или скриншоты. После изменения переменных запустите новый Deploy.

## 4. Проверьте публикацию

Откройте `https://ваш-проект.netlify.app/api/health`.

- `{"status":"ok"}` — есть подключение и доступ на чтение к таблицам users, sessions, auth_limits.
- `{"status":"unavailable"}` — проверьте `DATABASE_URL`, SSL, доступность базы и наличие таблиц из `db/001_auth.sql`. Подробности смотрите в **Deploys → Deploy log / Functions**.

Затем откройте сайт, зарегистрируйте участника и войдите. На `/simulator` должен открыться защищённый симулятор.

## Если нужен адрес hackalemakim.netlify.app

В **Domain management** убедитесь, что этот домен назначен именно проекту, затем установите `APP_ORIGIN` ровно в `https://hackalemakim.netlify.app` и повторно запустите Deploy. Если создаёте другой Netlify-проект, используйте его адрес `*.netlify.app` в `APP_ORIGIN`.

## Ошибки, которые обычно мешают

- Страница входа показывает «Сервис входа недоступен»: сервер не может подключиться к PostgreSQL или схема не создана.
- Вход или регистрация отклоняются по Origin: `APP_ORIGIN` не совпадает с адресом в браузере. Укажите точный HTTPS origin без `/` в конце.
- `/api/health` отвечает 503: проверьте строку подключения, разрешение внешних соединений, SSL и SQL-схему.
- Не открывается симулятор после входа: убедитесь, что Netlify собрал весь Next.js-проект из корня репозитория, а deploy завершился без ошибок.


## Проверка этой поставки

Локальные результаты и непроверенные внешние интеграции описаны в [VERIFICATION.md](VERIFICATION.md). Реальная публикация Netlify в ходе этой проверки не выполнялась.
