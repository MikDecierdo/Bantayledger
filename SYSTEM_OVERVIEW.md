# BantayLedger — System Overview & Progress

A reference doc for remembering how this system fits together and what's actually been built. Last updated: 2026-10-10 (multi-language: English, Tagalog, Cebuano; AI & insights: price-vs-demand scenarios, trending + seasonal insights, optional free AI explanations, auto-refresh; earlier: Supabase and the on-device SQLite backend fully removed — only MySQL remains).

---

## 1. Architecture — the short version

```
┌─────────────────────────┐        HTTP (REST + JSON)        ┌──────────────────────────────┐
│  Frontend (Ionic React)  │ ───────────────────────────────► │  Laravel backend              │
│  src/                     │ ◄─────────────────────────────── │  laravel-server/              │
│  runs via `npm run dev`   │                                   │  served by Apache (XAMPP)     │
│  http://localhost:5173    │                                   │  via a junction at            │
└─────────────────────────┘                                   │  C:\xampp\htdocs\bantayledger-api │
                                                                └───────────────┬──────────────┘
                                                                                │
                                                                                ▼
                                                                ┌──────────────────────────────┐
                                                                │  MySQL (MariaDB via XAMPP)     │
                                                                │  database: bantayledger_laravel │
                                                                └──────────────────────────────┘
```

**One frontend, one backend, one database.** Auth uses Laravel Sanctum (bearer tokens, no cookies). The frontend's API client (`src/services/api/client.ts`) always points at `http://localhost/bantayledger-api/public/api`.

### What used to exist, and why it's gone

| Thing | Status | Why |
|---|---|---|
| **Supabase** (Postgres, cloud) | **Removed** | Was the original backend. Replaced entirely, then fully deleted — the client package, config, migrations, and service layer are all gone from the project. Only MySQL remains. |
| **On-device SQLite** (`src/lib/db/`, `src/services/local/`) | **Removed** | Was a second, independent offline backend before the API-based architecture existed. Deleted along with its Capacitor SQLite plugin dependencies. |
| **Node/Express backend** (`server/`) | Abandoned | Built as a first MySQL backend attempt, fully working, but then replaced by the Laravel version below. Its database (`bantayledger`) was deleted since it was empty and unused. Still on disk, unlike Supabase/SQLite above — not part of this cleanup. |
| **Laravel backend** (`laravel-server/`) | **Active — this is the real backend** | Full rewrite of every domain (auth, catalogue, sales, purchases, expenses/waste, signals, account/business), verified end-to-end. |

---

## 2. Folder guide — what's real vs. legacy

Inside `C:\Users\Kim Victus\Documents\Bantayledger\`:

| Folder | Real or legacy? | Notes |
|---|---|---|
| `src/` | **Real** | The actual frontend app. Everything you interact with. |
| `laravel-server/` | **Real** | The actual backend source. Edit here — changes are live immediately (see §3 on the junction). |
| `server/` | Legacy | Old Node/Express backend. Not deleted, but not used by anything live. Safe to ignore or delete later. |
| `android/`, `ios/` | Dormant | Capacitor native shells, only relevant if building a mobile binary. |
| `dist/` | Build output | From a past `npm run build`. Regenerable, not source. |

**About `C:\xampp\htdocs\bantayledger-api`:** this is **not a separate folder of files**. It's a Windows directory *junction* pointing at `laravel-server/`. Apache needs something inside `htdocs` to serve PHP from, so this junction exists purely to satisfy that — editing either path edits the same files. There is no syncing step, because there's nothing to sync.

---

## 3. How to run it

1. **Start XAMPP** — Apache and MySQL both need to be running (XAMPP Control Panel → Start on both).
2. **Start the frontend:**
   ```
   cd "C:\Users\Kim Victus\Documents\Bantayledger"
   npm run dev
   ```
3. Open **http://localhost:5173**.

The Laravel backend needs no separate start command — Apache serves it automatically whenever XAMPP is running, via the junction described above. Do **not** run `php artisan serve` — that would start a second, redundant PHP server on a different port.

**If you ever edit `laravel-server/.env`:** run `php artisan config:cache` afterward (from inside `laravel-server/`). The backend's config is cached to avoid a `.env`-file-read race under concurrent requests (this caused the Dashboard's "Unable to load your business data" error on 2026-10-07 — every request hit Laravel's hardcoded `production`/`sqlite` fallback instead of the real `.env` values whenever several requests landed at once). A cached config means `.env` edits do nothing until you re-run `config:cache` (or `config:clear` to go back to live reads).

**Optional AI explanations:** the "Explain with AI" button stays hidden until a provider is configured in `laravel-server/.env` (`AI_API_KEY`, or `AI_BASE_URL` for a local Ollama), followed by `php artisan config:cache`. Everything else in the AI features works with no setup. See §5.

---

## 4. Progress — what's actually built

### Backend (Laravel, `laravel-server/`)
Every domain fully ported from the original Postgres/Supabase design, with business rules (stock ledger, status thresholds, authorization) re-implemented in application code rather than database triggers/RLS, and verified against the real running server + database:

- **Auth** — Sanctum token signup/login/logout/me, business creation on signup.
- **Catalogue** — categories, suppliers (with derived price-trend stats), products (with derived demand/restock stats).
- **Inventory ledger** — the core stock-movement engine (`InventoryService`) that every write path (sales, purchases, waste, manual adjustments) goes through, enforcing "stock can never go negative" with a friendly error message.
- **Sales** — atomic create (header + items + ledger + total in one transaction), delete-restores-stock.
- **Purchases** — pending/received status with correct stock timing, delete-restores-stock.
- **Expenses & Spoiled/Damaged items** — recording, auto cost-fill, overview summaries. (Users see "Spoiled & Damaged" with friendly Taglish reasons such as "Expired (Paso na)"; the code, API and database still call it `waste`.)
- **Signals** — alerts (CRUD, mark-read, counts), insights, forecasts. Generated by `app/Services/ForecastService.php` from the shop's own records (built-in statistics and rules; the only external AI is the optional explanation button). Runs via `POST /forecasts/refresh` — the Forecast and AI Insights pages call it on open when the records changed since the last run (or it is over a day old), and have a Refresh button. Full details in §5.
- **Account/Business** — profile editing, business editing, member list/role management.

Two roles only (2026-10-16): the **OWNER** (created automatically at sign-up) can edit the catalogue, delete records and manage the team; **STAFF** (added by the owner in **Settings → Team**) can record sales, purchases, expenses and spoiled items, adjust stock and view forecasts, insights and alerts. There is no Admin role any more (`business_users.role` is `OWNER` or `STAFF`). Team endpoints: `GET/POST /businesses/{b}/members`, `PATCH /members/{userId}/password` (owner resets a staff password; there is no email service yet), `DELETE /members/{userId}` (the owner cannot be removed). The owner sets the staff member's first password and passes it on.

### Frontend (`src/`)
Fully wired to the Laravel API (`src/services/api/*.ts`), with `AuthContext` rewritten to use Sanctum tokens exclusively.

Recently added (this session), fixing real gaps found in the existing UI:
- ✅ **Adjust Stock** — a button on each product's detail page and a quick-action icon on every row in Inventory, for correcting stock counts (e.g. "3 bags spoiled, wasn't logged"). The backend support for this existed already; there was simply no button anywhere to trigger it.
- ✅ **Mark Purchase as Received** — an action on pending purchases that flips them to received and releases their stock. Same situation: the backend supported it, nothing in the UI called it.
- ✅ **Monthly Supplies Budget** — new feature, built from scratch. One overall monthly spending cap on purchases, set/edited from the Purchases page, with a status badge (On track / Approaching limit / Over budget) and a warning banner. Deliberately warn-only — it never blocks recording a purchase.
- ✅ **Dashboard quick actions** — one-tap shortcuts (Record Sale, New Purchase, Add Expense, Update Stock) that land on the right page with the Add form already open, instead of needing to find the right menu item first.
- ✅ **POS-style Add Sale + product photos** (2026-10-08) — the Add Sale modal is now a tap-to-add tile grid (search + category chips) instead of a one-product-at-a-time dropdown; staff build a cart of multiple products, adjust quantity/price per line, then check out as one sale. The backend already supported multi-item sales in one transaction — only the UI was single-item. Product photos are new end-to-end: upload/remove endpoints (`POST`/`DELETE /businesses/{id}/products/{id}/image`), stored on Laravel's `public` disk via `storage:link`, shown on tiles and in the Inventory list, with an initials-tile fallback (`ProductThumbnail`) for products with no photo yet.


### Database keys (normalized 2026-10-16)

Every application table's primary key is named after its table, and a foreign key always has the same name as the key it points to, so a join reads the same on both sides (`sale_items.sale_id = sales.sale_id`).

| Table | Primary key | Other keys |
|---|---|---|
| users | `user_id` | |
| businesses | `business_id` | `owner_user_id` -> users |
| business_users | `business_user_id` | `business_id`, `user_id` |
| categories / suppliers | `category_id` / `supplier_id` | `business_id` |
| products | `product_id` | `business_id`, `category_id`, `supplier_id`, `variant_group_product_id` (self) |
| sales / sale_items | `sale_id` / `sale_item_id` | `business_id`, `user_id`, `verified_by_user_id`; items: `sale_id`, `product_id` |
| purchases / purchase_items | `purchase_id` / `purchase_item_id` | `business_id`, `supplier_id`, `user_id`; items: `purchase_id`, `product_id` |
| expenses | `expense_id` | `business_id`, `user_id` |
| waste_records | `waste_record_id` | `business_id`, `product_id`, `user_id` |
| inventory_movements | `inventory_movement_id` | `business_id`, `product_id`, `created_by_user_id`, and the source record: `sale_id` or `purchase_id` or `waste_record_id` (all empty = manual adjustment) |
| forecast_runs | `forecast_run_id` | `business_id` |
| demand_forecasts / price_forecasts / cost_forecasts | `demand_forecast_id` / `price_forecast_id` / `cost_forecast_id` | `business_id`, `product_id`, `forecast_run_id` |
| recommendations | `recommendation_id` | `business_id`, `product_id`, `forecast_run_id` |
| alerts | `alert_id` | `business_id`, `product_id` |
| cost_anomalies | `cost_anomaly_id` | `business_id`, `product_id`, `purchase_id` |

Laravel's own tables (`sessions`, `personal_access_tokens`, `password_reset_tokens`, `cache`, `jobs`) keep the framework's `id`; `sessions.user_id` is a real foreign key to `users.user_id`. The migration is `2026_10_16_000000_normalize_keys_and_foreign_keys` (reversible). **The API did not change:** responses still use `id`, `productId`, and so on; only the database column names did. New code must use the key names above (`DB::table('products')->where('product_id', ...)`); the `User` model exposes `id` as an alias of `user_id`.

### Capital, profit and available profit (2026-10-30)
- Every sale line stores `sale_items.unit_cost`, the product's buying price at the moment of the sale, so profit does not change when a buying price is edited later.
- Capital = quantity x `unit_cost`. Profit = sales - capital. **Available profit** = this month's profit - this month's expenses (never below zero). One helper, `app/Services/ProfitService.php`, does this math for both screens.
- `GET /sales/overview` adds `capital*` / `profit*` for today, week and month; `GET /expenses/overview` adds `profitMonth` and `availableProfit`.
- **Split payments (2026-10-31):** a sale's payment is one or two rows in `sale_payments` (`Cash` and/or `GCash`, each with its amount, GCash with the last 4 digits). `sales.payment_method` is `Cash`, `GCash` or `Mixed`. `POST /sales` takes `payments: [{method, amount, reference?}]` (the parts must add up to the total, each method once) or the older single `paymentMethod`. Today's Cash / GCash cards sum `sale_payments`, so a split sale counts in both. Duplicate GCash reference detection also reads `sale_payments`.
- **Desktop "fit to screen" layout (2026-10-31):** on screens at least 1024px wide and 640px tall, every page fills the window and the page itself never scrolls. Pages are built from `components/layout/Workspace.tsx`: `Workspace` (page frame), `Bento` (12-column grid that takes the remaining height, `bl-span-*` widths), `Rail` (stacked side cards) and `MiniStats`. `<Card fill>` keeps its heading still and scrolls its content inside the card, with sticky table headings. Charts take `fill` to grow to their card. Settings shows one group at a time beside a group list there. Phones, tablets and short windows keep normal page scrolling. The media query lives in `FIT_QUERY` (`hooks/useBreakpoint.ts`) and the CSS files.
- **Windows (modals):** one component (`components/common/Modal.tsx` + `Modal.css`) draws every window: tinted header with a picture, white section cards on a light body, never any sideways scroll, height follows the content, and a bottom sheet on phones. Pass `icon` (and `tone="danger"` for confirmations). `PaymentBadge` / `PaymentBadges` (in `PaymentLogos.tsx`) show the Cash and GCash logos.
- `GET /sales` returns `unitCost` per item and `capital` / `profit` per sale; the Sales list has a View button that opens these per product.
- `POST /expenses` returns 422 when the amount is more than the available profit for the expense's month. The Add Expense window shows the indicator and caps the amount the same way.

---

## 5. AI & insights features

**How it works, honestly.** The insights are not produced by a trained model. `ForecastService` applies plain statistics and business rules to the shop's own recorded sales, stock, purchases and waste, and writes the results to the database. The only external AI is the **optional** "Explain with AI" button (§5.3). Confidence numbers shown in the app come from how much history a product has, so a product with only a few days of sales gets a low-confidence forecast.

### 5.1 What the system generates

| Feature | Where it shows | What it does |
|---|---|---|
| **Demand forecast** | Forecast page | 7-day forecast per product: `0.6 × last-7-day average + 0.4 × 28-day average`, with a range of ± one standard deviation. Sales are bucketed by the sale's own date, not when it was keyed in. Needs at least some sales history. |
| **Supplier-price forecast** | Forecast page | Next 3 months of supplier price per product from received purchases, once a product has purchases on **2+ different dates**. The trend is damped (half the fitted slope) and capped at 5% of the latest price per month, so a short history can't predict a wild jump. |
| **Purchasing-cost forecast** | Forecast page | Forecast demand × forecast unit price per product, compared with the previous cost. |
| **Alerts** | Alerts page, sidebar badge | Out of stock, critically low, running low, may run out within 3 days, supplier price rising (>5%), restock cost above your margin, purchase still pending after 7 days. Alerts are matched across runs, so an alert you already read stays read. |
| **Recommendations (AI Insights)** | AI Insights page, Dashboard | Reorder (with a suggested quantity), buy before the price rises, slow movers (no sale in 30 days), waste to reduce, thin or negative margin. Each card shows finding, why it matters, recommended action and supporting figures. |
| **Price-vs-demand scenarios** | AI Insights, Alerts | Compares what you paid with what restocking will cost, together with how demand is moving (sales last 7 days vs the 4-week average; rising at +25%, slowing at −25%; price gap of 5%). **Bought low + demand high** → "Stock up while your cost is low" and "Your margin rests on cheaper old stock" with a suggested price for a 20% margin. **Bought high + demand low** → "Hold off reordering" and "Clear costly stock". **Margin squeeze** → "Restocking will cost more than your margin allows". "Hold off" is skipped when stock is genuinely short (reorder wins). |
| **Weighted-average cost** | Inventory, Reports, margins | When a purchase is received, the product's `cost_price` becomes the weighted average of the stock on hand and the new batch (10 at ₱40 + 10 at ₱50 → ₱45). This keeps margins, stock value, waste cost and every cost-based insight in step with real prices. Cancelling or deleting a received purchase does **not** rewrite the cost. |
| **Trending / top-seller insights** | AI Insights ("Trending" filter) | The top 3 products by revenue in the last 7 days (at least 5 units). A product is "trending" when its units are up 30% or more on the week before, or it is new. Each card carries: sold this week, week before, change, share of sales, seasonal yes/maybe/no, days of stock left, plus a plain-language reason and suggested action. |
| **Seasonal & benefits guide** | Inside trending insights | `SeasonKnowledge` is a small offline guide for Philippine retail: hot dry season (Mar–May), rainy/typhoon season (Jun–Nov), "-ber months" (Sep–Dec), back-to-school (Jun–Aug), Lent (Mar–Apr), December bonus. It matches by product name and category and adds a one-line description of why people buy the product. If the shop's own history shows the product sold strongly in the same month before, that is used first and labelled "from your records". Otherwise it is labelled "General knowledge, not verified for your area". |
| **Price what-if** | Forecast page | Enter a supplier price change (−90% to +300%, or a preset). Per product it shows cost before and after, margin before and after (flagged Thin below 10%, Loss below 0), the selling price that keeps today's margin, and the effect on monthly purchasing at the forecast pace. Runs in the browser; nothing is saved. |
| **Auto-refresh** | AI Insights, Forecast (the Dashboard shows the latest run) | Opening AI Insights or Forecast regenerates insights when the shop's records changed since the last run. A "fingerprint" (counts and latest timestamps of sales, purchases and their statuses, waste, stock movements, products, suppliers) is stored with each run, so edits **and deletions** are noticed. A run is also redone after 24 hours (some figures depend on today's date) and never twice within 60 seconds. The Refresh button always forces a run. |

### 5.2 Where the code lives

| Area | Files |
|---|---|
| Generator | `laravel-server/app/Services/ForecastService.php` (forecasts, alerts, recommendations, scenarios, trending, fingerprint/freshness) |
| Seasonal guide | `laravel-server/app/Services/SeasonKnowledge.php` |
| AI explanation | `laravel-server/app/Services/InsightExplainer.php` |
| Weighted-average cost | `InventoryService::applyPurchaseCost`, called from `PurchaseController` (create as received, and pending → received) |
| API | `laravel-server/app/Http/Controllers/Api/SignalController.php`, routes in `routes/api.php`, settings in `config/services.php` (`ai`) |
| Frontend | `src/pages/AIInsights.tsx`, `src/components/dashboard/AIInsightCard.tsx`, `src/pages/Forecast.tsx`, `src/components/forecast/PriceWhatIf.tsx`, `src/services/api/signalService.ts` |

**API calls the AI pages make** (all under `/businesses/{id}`, with the Sanctum bearer token): `POST /forecasts/refresh` (`?ifStale=1` on page open; without it for the Refresh button), `GET /insights`, `GET /forecasts`, `GET /alerts`, and `POST /insights/{id}/explain` for the optional AI write-up.

**Tables:** `demand_forecasts`, `price_forecasts`, `cost_forecasts` and `recommendations` are replaced wholesale on each run (a snapshot); `alerts` are reconciled so read state survives; `forecast_runs` records each run and its fingerprint. `recommendations` has `topic` (e.g. `trending`) and `supporting` (JSON figures); `products.cost_price` is now updated automatically by received purchases.

### 5.3 Optional "Explain with AI" (off until configured)

On a trending insight, an **Explain with AI** button asks an AI model for a short "why it's trending / benefits / seasonal or not" write-up. It is hidden unless a provider is set in `laravel-server/.env`:

| Setting | Meaning |
|---|---|
| `AI_PROVIDER` | `gemini` (default), `openai` (any OpenAI-compatible endpoint) or `anthropic` |
| `AI_API_KEY` | The provider key. Not needed for a local Ollama. |
| `AI_MODEL` | Model name. Defaults: `gemini-2.5-flash`, `claude-haiku-5-5`, `llama3.2`. Free-tier model names change, so check your provider if it errors. |
| `AI_BASE_URL` | Only for `openai`, e.g. `http://localhost:11434/v1` (Ollama) or `https://api.groq.com/openai/v1` |

Free options: **Google Gemini free tier** (key from Google AI Studio, no card), **Ollama** on your own PC (fully local), or the free tiers of Groq / OpenRouter. After editing `.env`, run `php artisan config:cache`.

- **Privacy:** only the product name, its category, four weekly unit counts and the built-in reason are sent. Never the business name, customers, prices or user details. The key stays on the server and is never sent to the browser. Free-tier providers may use prompts to improve their products.
- **Cost guards:** one answer per business, product and week (cached), at most 10 AI explanations per business per day, 15-second timeout. When a free quota is used up the user sees a plain message instead of an error.
- **Accuracy:** answers are generated text and can be wrong. The card says so.

### 5.4 Limits

- Statistics need history: with only a few days of sales, forecasts and trend insights are low-confidence or absent.
- The seasonal guide is hand-written general knowledge, not live market data, and says "likely" on purpose.
- There is no machine-learning model; everything is rules and simple statistics.
- The optional AI call has been verified with simulated provider responses for every provider type, but **not yet against a live key** — try it once after adding your key.

### Friendly wording (what users read vs the names in code)

The app avoids jargon. Display text changed; stored values, API fields, routes and database columns did not.

| Users read | Code / database name |
|---|---|
| Spoiled & Damaged (reasons: Expired (Paso na), Damaged (Nasira), Spoiled (Panis / Sira), Spilled (Natapon), Returned by customer (Ibinalik)) | `waste`, `WasteReason` |
| Product code · Low-stock level · Usual order size | `sku` · `minimumStock` · `reorderQuantity` |
| Buying price · Selling price · Price per piece | `costPrice` · `sellingPrice` · `unitCost` |
| Profit | margin |
| Total sales | gross sales |
| Enough · Low · Almost out · Out of stock | `healthy` · `low` · `critical` · `out` |
| Urgent (alerts) | severity `critical` |
| Expected sales · Sold per day · Days of stock left · How sure we are / "85% sure" | demand forecast · `averageDailyDemand` · `daysOfCover` · `confidence` |
| Time to restock · Wait before restocking | reorder recommendations |

## 6. Languages (English, Filipino/Tagalog, Bisaya/Cebuano)

The whole app can be used in English, Tagalog or Cebuano. Pick the language in **Settings → Display settings → Language**, or from the small selector on the sign-in screens. Choosing one saves it in the browser and reloads the page so everything — including numbers, dates and receipts — appears in that language. The first visit follows the browser's language if it is Filipino or Cebuano.

**How it works**
- **Screens (frontend):** `src/i18n/` uses `i18next`. The **English sentence is the key** — `t('Add Sale')` — so English needs no dictionary and a missing translation simply shows English. Translations live in `src/i18n/locales/tl.json` and `ceb.json`. `t()` is global, so it also works in toasts, dialogs and the PDF/image receipts.
- **Editing translations:** edit the part files in `scripts/i18n-parts/*.json` (each line is `"English": ["Tagalog", "Cebuano"]`), then run `npm run merge:i18n`. `npm run check:i18n` lists any English text in the code that has no translation yet and any `{{placeholder}}` that doesn't match.
- **Numbers and dates** follow the language (`en-PH`, `fil-PH`, `ceb-PH`); currency stays ₱.
- **Server messages:** the app sends `Accept-Language` with every request and the `SetLocale` middleware switches the server to it. Error messages, validation messages, and the AI Insights/Alerts sentences are translated by Laravel from `laravel-server/lang/tl.json` and `ceb.json` (`:name` placeholders), plus `lang/tl/validation.php` and `lang/ceb/validation.php`.
- **Insights and alerts are stored language-neutral:** `ForecastService` saves each sentence as an English template plus its parameters (`App\Support\Msg`, in the `i18n` column), so the same stored insight is shown in each reader's own language with no regeneration. The plain `title`/`message` columns still hold the English text as a fallback.
- **AI explanations** ask the model to answer in the reader's language.
- **Stored values never change** (payment methods, expense categories, roles, reasons); only their display names are translated (`src/i18n/labels.ts`, `wasteReasonLabel`).

**Welcome step (data notice + language):** the first time someone signs in — right after creating an account, or on the first login of an existing account — a full-screen step (`src/pages/Welcome.tsx`) has two screens. **Step 1:** a plain-language data notice (what is collected and why, where it is stored and who can see it, AI and outside services, their rights) with a required "I have read and understand this notice and I agree to it" checkbox and a **Continue** button. **Step 2 (after Continue):** choose a language (English / Filipino / Bisaya), then **Get started**. Choosing a language reloads the page; the agreement is remembered for the session so the person stays on step 2. It is shown once per account: the acceptance date, notice version and language are saved on the user (`users.privacy_accepted_at`, `privacy_version`, `language`) through `POST /profile/consent`, so signing in on another device doesn't ask again and a new browser follows the account's language. To make everyone read an updated notice, raise `AuthController::PRIVACY_NOTICE_VERSION`. **Before launch:** fill in `PRIVACY_CONTACT` in `Welcome.tsx` (while empty it tells people to ask their business owner) and have the notice wording reviewed against the Philippine Data Privacy Act of 2012 — it is a plain-language summary, not legal advice.

**Adding another language** (e.g. Hiligaynon or Waray): add `src/i18n/locales/<code>.json`, register it in `src/i18n/index.ts` (`LANGUAGES` + resources), add `laravel-server/lang/<code>.json` and `lang/<code>/validation.php`, and add the code to `SetLocale::SUPPORTED`.

**Caveats**
- The Tagalog and Cebuano text was drafted by the developer's assistant in simple everyday store language and has **not** been reviewed by native speakers. Expect some phrases to need polishing — they are all in the files above and easy to correct.
- Longer Tagalog/Cebuano words can make some buttons, table headings or the pinned summary cards tighter than in English; that has not been checked on screen yet.
- Insights created before this feature are shown in English until the next refresh regenerates them.

---

## 7. Known gaps — what's *not* done yet

- **No offline/sync layer.** The on-device SQLite cache + sync-outbox idea (from before the Laravel API existed) is gone along with the SQLite backend itself — the app currently requires a live connection to the backend at all times.
- **AI explanation not yet tried against a live provider.** The code and error handling are tested with simulated responses; it needs your free Gemini (or other) key to try for real.
- **Forecast accuracy tracking.** Forecasts and insights are generated now (see §5), but the "Forecast trends" and "Forecast accuracy" sections stay empty until weeks of past runs exist to compare against what actually sold.
- **Broader navigation simplification.** The Dashboard quick actions address the most common daily tasks, but the underlying page list (13 destinations, 8 of them behind a "More" sheet on mobile) hasn't been restructured.
- **Password reset / email.** No email service is wired up — there's no "forgot password" flow that actually works yet.
- **Legacy code cleanup.** `server/` (Node backend) is still sitting in the project, unused. Safe to delete whenever convenient, but hasn't been done since nothing's forced the issue.
