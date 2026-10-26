# UkrEcoPelleta — сайт ТОВ «УКРЕКОПЕЛЕТА»

Сайт заводу деревних пелет у Нікополі: оптові поставки (від 15 т) по всій Україні. Українська та російська
версії (`/ru/`) і англійський перемикач. Сторінки: головна, `/pellets` (ціна, калькулятор, форма заявки),
`/pelety-optom`, сторінки міст (`/pelety-<місто>`), `/oferta`, `/privacy`.

Статичний HTML на Vercel (`api/lead.js` приймає заявки), перед ним Cloudflare Worker (`cloudflare/`): редирект на
https, ціна з KV, Telegram-бот для зміни цін. Деталі — `DEPLOY.md`, `docs/BOT_DEPLOY.md`, `DESIGN.md`.

## Команди

```bash
npm start        # локальний сервер на http://localhost:3000
npm test         # SEO-перевірка, API заявок, телефони, тести Worker (те саме запускає CI)
npm run sync     # оновити спільні блоки у всіх сторінках (хедер, футер, CSS, версії файлів)
```

Потрібен Node.js 20 або новіший. Залежностей немає.

## Як усе влаштовано

- Спільні блоки сторінок, російські копії та сторінки міст **генеруються** скриптами в `scripts/`. Не правте
  згенеровані місця вручну: змініть джерело й запустіть `npm run sync` (правила — `CLAUDE.md`).
- Ціни: `data/pricing.json` (змінює Telegram-бот) → Action «Price sync» оновлює всі сторінки.
- Дизель для калькулятора доставки: `data/fuel.json`, оновлюється щодня Action «Diesel price update».
- Заявки: форма → `api/lead.js` → пошта (Resend) і Telegram. Змінні середовища — `.env.example`.
- Секрети в репозиторії не зберігаються. Токени бота — секрети Cloudflare Worker.

## Структура

```text
index.html, pellets.html, pelety-*.html, oferta.html, privacy.html   сторінки (ru/ — російські копії)
assets/    css, js (i18n, калькулятор, форма), images, data/places.json (населені пункти та відстані)
api/       lead.js (заявки), pricing.js (запасне джерело цін)
cloudflare/ Worker і Telegram-бот      data/  ціни, дизель, словник ru
scripts/   генератори, SEO-перевірка, тести      docs/  інструкції (бот, Google Ads, Business Profile)
```
