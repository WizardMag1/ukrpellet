# Google Business Profile: ready-to-paste kit (UkrEcoPelleta)

Why this matters: for searches like "пелети Нікополь", "купити пелети Дніпро" or "пеллеты Никополь", Google shows the
**map block (3 companies on the map) above the ordinary results**. Only companies with a Business Profile can appear
there. For a local producer this is the fastest source of calls. It is free.

Language rule: the profile is in **Ukrainian**. Russian is never the main language (see `scripts/build-ru.cjs`).

Where: https://business.google.com/create. Use the same Google account that owns Search Console.

---

## 1. Name

```
UkrEcoPelleta
```

Only the real brand name. **Do not** add keywords ("пелети Нікополь опт"): Google suspends profiles for that.
If the sign on the plant says something different (e.g. «Укрекопелета»), use exactly what is on the sign.

## 2. Categories

Pick from Google's list (the wording in the interface may differ slightly; take the closest match):

- **Primary:** «Постачальник палива» (Fuel supplier). If a pellet or biofuel category exists, use it instead.
- **Additional:** «Виробник» (Manufacturer), «Оптовий торговець» (Wholesaler), «Постачальник дров» (Firewood supplier).

## 3. Location type

The plant takes pickup orders (from 1 big bag), so it is a business **with an address that customers visit**:

- Address: the plant's real address in Nikopol (street and building number, postcode 53200).
  ⚠ The site only gives coordinates `47.58261, 34.33747`. Use the real legal or plant address; Google will send
  a verification code there or ask for a video of the place.
- **Service area** (add it as well): Дніпропетровська область; Дніпро; Кривий Ріг; Кам'янське; Павлоград;
  Марганець; Покров; Нікополь.

## 4. Contacts

| Field | Value |
|---|---|
| Phone | +38 066 403 53 96 |
| Website | `https://ukrecopelleta.org/pelety-nikopol?utm_source=google&utm_medium=organic&utm_campaign=gbp` |
| Opening hours | Mon–Fri 08:00–18:00, Sat 09:00–15:00, Sun closed |

The UTM tag shows in Vercel Analytics which visits came from the map.

## 5. Description (up to 750 characters, paste as is)

```
UkrEcoPelleta — завод деревних паливних пелет у Нікополі. Виробляємо гранули 6 мм із чистої сосни або суміші акації з берестом, без кори та хімічних домішок. Параметри класу A1, паспорт якості на кожну партію.

Ціна — 14 500 грн/т зі складу без ПДВ. Фасування — біг-беги ≈650 кг.
Самовивіз із заводу в Нікополі — від 1 біг-бега за попередньою домовленістю.
Доставка по Дніпропетровській області (Дніпро, Кривий Ріг, Кам'янське, Павлоград, Марганець, Покров) — партіями від 15 тонн.

Працюємо з котельнями, підприємствами, ОСББ, бюджетними установами (документи для Prozorro) та приватними покупцями. Безготівковий розрахунок з ПДВ.

Онлайн-калькулятор ціни з доставкою — на сайті ukrecopelleta.org.
```

## 6. Products (Products section, each with a photo)

| Name | Price | Description | Button link |
|---|---|---|---|
| Пелети 6 мм, сосна, біг-бег | 14 500 грн/т | Гранули 6 мм із чистої сосни, біг-бег ≈650 кг, самовивіз із Нікополя від 1 біг-бега | `/pelety-nikopol` |
| Пелети 6 мм, акація + берест | 14 500 грн/т | Суміш акації з берестом, висока теплотворність, біг-беги ≈650 кг | `/pellets#specs` |
| Пелети оптом від 15 тонн з доставкою | from 14 500 грн/т + доставка | Повна фура ≈23 біг-беги по Дніпропетровській області | `/pelety-optom` |

## 7. Services

Самовивіз пелет із заводу · Доставка пелет по Дніпропетровській області · Оптові поставки пелет ·
Поставки пелет для бюджетних установ (Prozorro) · Договір поставки на опалювальний сезон.

## 8. Photos (the most important part after the address)

Upload **at least 10 real photos** taken on a phone at the plant, not stock images:
1. Logo (`assets/images/icon-512.png`) and cover photo (`assets/images/hero-pellets.jpg`)
2. Plant entrance / sign (exterior, so customers can find it)
3. Production line, press
4. Warehouse with big bags
5. Close-up of pellets in a hand
6. Truck loading
7. Quality passport (blur any personal data)

Add 2–3 new photos each month. Profiles with fresh photos get more views.

## 9. First 3 posts (Updates → Add update)

1. **Ціна на сезон.** «Пелети 6 мм — 14 500 грн/т зі складу в Нікополі. Самовивіз від 1 біг-бега, доставка по області від 15 т. Порахуйте ціну з доставкою в калькуляторі.» → button "Learn more" → `/pellets#calculator`
2. **Доставка в Дніпро.** «Веземо пелети від заводу в Дніпро (~125 км) партіями від 15 тонн. Документи на кожну партію.» → `/pelety-dnipro`
3. **Для котелень і бюджетних установ.** «Документи для Prozorro, договір із графіком поставок на опалювальний сезон.» → `/pelety-optom`

Post at least once a week during the heating season (October–March).

## 10. Reviews

Reviews are the number one factor for ranking in the map block. Ask **every** customer after loading.
Short link: Profile → "Ask for reviews" → copy the link. Message for Viber/Telegram:

```
Дякуємо, що обрали UkrEcoPelleta! Будемо вдячні за короткий відгук про пелети та доставку — це допомагає іншим покупцям: <посилання>
```

Reply to every review within 1–2 days. Never buy or write fake reviews: Google removes them and can suspend the profile.

## 11. Questions and answers

Add these answers in "Questions":
- «Яка мінімальна партія?» → «Самовивіз — від 1 біг-бега (≈650 кг). Доставка по області — від 15 тонн.»
- «Чи є документи для тендерів?» → «Так, надаємо документи для Prozorro, безготівковий розрахунок з ПДВ.»
- «Який діаметр гранул?» → «6 мм, підходить для побутових котлів і пальників котелень.»

## 12. After verification (Claude does this, tell it the profile link)

- Add the profile link to `sameAs` in the site's JSON-LD (LocalBusiness), so Google links the site and the map listing.
- Put the map with the plant address on `/pelety-nikopol`.
- List the same name, address and phone (identical spelling) in directories: Prom.ua, OLX, list.in.ua, Visicom.
