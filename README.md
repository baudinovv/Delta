# Delta

Training app for gym beginners who train without a coach: log sets, track food with a photo, ask an AI coach, see progress on a dashboard. Russian and English UI.

- `backend/` - Spring Boot 3, Java 21, PostgreSQL, Flyway
- `mobile/` - React Native (Expo), TypeScript, runs on iOS/Android (Expo Go) and in the browser

## Backend

```bash
cp .env.example .env      # optional: GEMINI_API_KEY, DB_PORT
docker compose up --build
```

or run only the db in docker: `docker compose up -d db && cd backend && mvn spring-boot:run`

Tests: `mvn test` (or without local Java: `docker run --rm -v "$PWD/backend":/app -w /app maven:3.9-eclipse-temurin-21 mvn test`)

### AI (coach + calories from a photo)

Uses Google Gemini, which has a free tier. Get a key at https://aistudio.google.com/apikey and put it in `.env` next to `docker-compose.yml`:

```
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

Without a key the backend runs in **demo mode**: the coach and photo analysis return sample answers and the app shows a "demo mode" banner, so every screen still works. Free-tier limits are small and per project; when they run out the app shows "AI quota used up, try again in a minute". On the free tier Google may use requests to improve its models, so don't send anything sensitive.

## Mobile

```bash
cd mobile
npm ci
cp .env.example .env
npx expo start
```

**Phone (Expo Go):** put your computer's local IP in `.env` (`EXPO_PUBLIC_API_URL=http://192.168.x.x:8080`, find it with `hostname -I` / `ipconfig getifaddr en0`), scan the QR (camera on iOS, Expo Go on Android). Phone and laptop on the same Wi-Fi. Restart with `npx expo start -c` after changing `.env`.

**Browser:** press `w` in the Expo terminal or run `npx expo start --web`. Good for checking design and flows; the camera button opens a file picker there.

### Apple Health / Health Connect

Health sync uses native modules, so it **does not work in Expo Go** (the Health screen says so; everything else still works). Build the app once with [EAS](https://expo.dev/eas) and install it on the phone; after that it loads JS from `npx expo start` like Expo Go does.

```bash
cd mobile
npx eas-cli login                                       # free expo.dev account
npx eas-cli build --profile development --platform android   # APK, install it on the phone
npx expo start --dev-client
```

- **Android:** Health Connect is built into Android 14+. On Android 9–13 install "Health Connect" from Google Play first (the app shows a button for it). Delta reads steps, active calories, heart rate and workouts (e.g. from Galaxy Watch / Wear OS via their apps) and writes logged strength sessions as workouts.
- **iOS:** same command with `--platform ios`. Needs a paid Apple Developer account (HealthKit entitlement + device provisioning). Not testable without it.
- Data is uploaded only after the user agrees on the Health screen; turning sync off deletes everything synced on the server. Finished Delta sessions are written to Health automatically; today's session only on "Save today's workout".

Troubleshooting:
- phone can't reach Metro: open port 8081 in the firewall (`sudo ufw allow 8081/tcp` on Ubuntu)
- Wi-Fi isolates clients (university/guest networks): use a phone hotspot, or `npx expo start --tunnel` (the API still has to be reachable from the phone)
- Android emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8080`

## API

| Method | Path | |
|---|---|---|
| POST | `/api/auth/register` | sign up: 18+ check, health questions, consent, goal/days/minutes, optional body, and `account` {name, email, password ≥ 8}. The account is created only if screening passes. Returns token |
| POST | `/api/auth/login` | email + password → token. 5 failed attempts per email lock it for 15 min |
| POST | `/api/auth/logout` | ends the current session (other devices stay signed in) |
| POST | `/api/auth/password` | change password; signs out other devices |
| POST | `/api/auth/delete-account` | deletes the account and all its data (password required) |
| GET | `/api/me` | profile (name, email) + daily calorie/macro targets |
| PUT | `/api/profile` | update name, goal, plan, body, own calorie target |
| GET | `/api/dashboard` | today's calories/macros, 7-day calories and training volume, workouts this week, streak, top lifts by week |
| GET | `/api/log/today` | exercises with last weight x reps prefilled |
| POST | `/api/log/sets` | log a set |
| DELETE | `/api/log/sets/{id}` | delete a set |
| GET | `/api/summary/weekly` | weekly summary |
| GET | `/api/nutrition/day?date=` | food diary for a day: entries, totals (incl. fiber/sugar), targets, water |
| POST | `/api/nutrition/entries` | add items to a meal: a catalog food (`foodId` + `grams`, nutrition computed on the server) or a free-form item (name + kcal + macros) |
| POST | `/api/nutrition/copy` | copy a meal from another day ("same as yesterday") |
| POST | `/api/nutrition/water` | add/remove water (`deltaMl`) for a day |
| GET | `/api/nutrition/report?days=7\|14\|30` | per-day totals, averages, macro energy split, days on target, top foods |
| GET | `/api/foods/search?q=&lang=&online=` | search the catalog (built-in + own foods); `online=true` also searches Open Food Facts |
| GET | `/api/foods/barcode/{code}` | product by barcode: own foods → catalog → Open Food Facts (imported on first use) |
| GET | `/api/foods/{id}` · `/recent` · `/favorites` · `/mine` | food details with servings; recently logged; favorites; own foods and recipes |
| PUT/DELETE | `/api/foods/{id}/favorite` | add to / remove from favorites |
| POST | `/api/foods` · `/api/foods/recipes` | create an own food (per 100 g, optional portion and barcode) or a recipe from ingredients |
| DELETE | `/api/foods/{id}` | delete an own food or recipe |
| DELETE | `/api/nutrition/entries/{id}` | delete a food item |
| POST | `/api/nutrition/analyze` | photo (base64 JPEG) → dish, items with grams/kcal/macros. Nothing is saved until the user confirms |
| GET | `/api/coach/messages` | AI coach chat history |
| POST | `/api/coach/messages` | ask the coach; it sees the profile, last 14 days of sets and today's food |
| DELETE | `/api/coach/messages` | clear the chat |
| GET | `/api/health/status` | health sync consent, last sync, number of stored samples |
| PUT | `/api/health/consent` | `{consent: true\|false}`; false also deletes all synced health data |
| POST | `/api/health/sync` | upload samples from Apple Health / Health Connect (`IOS`/`ANDROID`): workouts and daily steps / active energy / heart rate; upsert by platform record id |
| GET | `/api/health/summary?days=7` | per-day steps, active kcal, heart rate; workouts from other apps; today's totals |
| GET | `/api/health/sessions?days=14` | Delta strength sessions (a day of sets) for writing back to Health |
| DELETE | `/api/health/data` | delete synced health data, keep consent |

Everything except register/login needs `Authorization: Bearer <token>`. Passwords are stored as BCrypt hashes, session tokens as SHA-256 (one row per device in `sessions`).

Food data: ~150 common foods in Russian and English live in `backend/src/main/resources/foods/builtin.json` (loaded on startup), packaged products come from [Open Food Facts](https://world.openfoodfacts.org) (free, no key; search via search.openfoodfacts.org, barcodes via the product API). Nutrition is stored per 100 g with named portions.

Calorie target: Mifflin-St Jeor BMR × activity (from training days per week) + goal adjustment (+300 kcal build muscle, +150 get stronger). Protein 1.8 g/kg, fat 27% of calories, carbs the rest. Users can set their own target instead.
