# Implementation Plan: UkrEcoPellet (ТОВ «УКРЕКОПЕЛЕТА») Rebrand & System Upgrade

## Overview
Migrate company identity to **ТОВ «УКРЕКОПЕЛЕТА»** (UKREKOPELLET, LLC / ЄДРПОУ 45009223), switch corporate phone to **`+380664035396`**, correct wood species from birch to **берест (elm)**, configure the dedicated Telegram Bot (**`@UkrEkoPelletaBot`**), and integrate Claude/gstack engineering skills into Hermes.

---

## 1. Company Identity & Legal Baseline
- **Legal Entity (UK)**: ТОВ «УКРЕКОПЕЛЕТА» (ТОВАРИСТВО З ОБМЕЖЕНОЮ ВІДПОВІДАЛЬНІСТЮ "УКРЕКОПЕЛЕТА")
- **Legal Entity (EN)**: UKREKOPELLET, LLC (UKREKOPELLET, LIMITED LIABILITY COMPANY)
- **Commercial Brand**: UkrEcoPellet (УкрЕкоПелет)
- **Код ЄДРПОУ**: 45009223
- **Керівник**: Охромій Олександр Васильович
- **Засновник / Бенефіціар**: Циганков Олександр Олександрович (100%)
- **Юридична адреса**: 53201, Україна, Дніпропетровська обл., Нікопольський р-н, м. Нікополь
- **Контактний телефон**: +38 (066) 403-53-96 (+380664035396)

---

## 2. Product Specification Correction
- **Сировина (UK)**: Сосна, акація, берест (не береза)
- **Raw Material (EN)**: Pine, Acacia & Elm wood (not birch)
- **Фракція / Діаметр**: 6 мм та 8 мм (ENplus A1)
- **Фасування**: Біг-Беги по 600–650 кг
- **Оптова доставка**: Від 15 біг-бегів (≈ 9–10 тонн) по Дніпропетровській області
- **Самовивіз**: Від 1 біг-бега у Нікополі

---

## 3. Communication & Lead System
- **Telegram Bot**: `@UkrEkoPelletaBot` (Token configured in `.env` & Vercel)
- **Phone & Messengers**: `+380664035396` (Call, Telegram, Viber)
- **Vercel Serverless**: `/api/lead` routes to Telegram Bot & Supabase

---

## 4. Execution Steps
- [x] Step 1: Transfer Claude/gstack plugins to Hermes default and ukrpellet profile.
- [ ] Step 2: Update `assets/js/analytics-config.js` with new credentials and phone.
- [ ] Step 3: Update `assets/js/i18n.js` with new brand, legal name, phone, and elm/берест.
- [ ] Step 4: Update `index.html` (Schema.org, header, hero, features, footer).
- [ ] Step 5: Update `pellets.html` (Schema.org, specs, calculator, lead form, messengers).
- [ ] Step 6: Update `oferta.html` and `privacy.html` with official legal text and requisites.
- [ ] Step 7: Update `api/lead.js` and `.hermes.md`.
- [ ] Step 8: Commit changes, push to GitHub, deploy to Vercel, and verify live endpoints.
