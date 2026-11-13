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

Troubleshooting:
- phone can't reach Metro: open port 8081 in the firewall (`sudo ufw allow 8081/tcp` on Ubuntu)
- Wi-Fi isolates clients (university/guest networks): use a phone hotspot, or `npx expo start --tunnel` (the API still has to be reachable from the phone)
- Android emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8080`

## API

| Method | Path | |
|---|---|---|
| POST | `/api/onboarding` | 18+ check, health questions, consent, goal/days/minutes, optional body (sex, birth year, height, weight). Returns token |
| GET | `/api/me` | profile + daily calorie/macro targets |
| PUT | `/api/profile` | update goal, plan, body, own calorie target |
| GET | `/api/dashboard` | today's calories/macros, 7-day calories and training volume, workouts this week, streak, top lifts by week |
| GET | `/api/log/today` | exercises with last weight x reps prefilled |
| POST | `/api/log/sets` | log a set |
| DELETE | `/api/log/sets/{id}` | delete a set |
| GET | `/api/summary/weekly` | weekly summary |
| GET | `/api/nutrition/day?date=` | food diary for a day with totals and targets |
| POST | `/api/nutrition/entries` | add food items to a meal |
| DELETE | `/api/nutrition/entries/{id}` | delete a food item |
| POST | `/api/nutrition/analyze` | photo (base64 JPEG) → dish, items with grams/kcal/macros. Nothing is saved until the user confirms |
| GET | `/api/coach/messages` | AI coach chat history |
| POST | `/api/coach/messages` | ask the coach; it sees the profile, last 14 days of sets and today's food |
| DELETE | `/api/coach/messages` | clear the chat |

Everything except onboarding needs `Authorization: Bearer <token>`.

Calorie target: Mifflin-St Jeor BMR × activity (from training days per week) + goal adjustment (+300 kcal build muscle, +150 get stronger). Protein 1.8 g/kg, fat 27% of calories, carbs the rest. Users can set their own target instead.
