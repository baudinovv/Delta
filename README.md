# Delta

Training progress app for gym beginners who train without a coach. Log your sets, get a weekly summary on Sunday.

- `backend/` - Spring Boot 3, Java 21, PostgreSQL, Flyway
- `mobile/` - React Native (Expo), TypeScript

## Backend

```bash
docker compose up -d db
cd backend
mvn spring-boot:run
```

or everything in docker: `docker compose up --build`

Tests: `mvn test`

## Mobile

```bash
cd mobile
npm install
cp .env.example .env
npx expo start
```

Put your computer's local IP in `.env` (`EXPO_PUBLIC_API_URL=http://192.168.x.x:8080`) and open the app in Expo Go. Phone and laptop should be on the same wifi.

## API

| Method | Path | |
|---|---|---|
| POST | `/api/onboarding` | 18+ check, health questions, consent, goal/days/minutes. Returns token |
| GET | `/api/me` | profile |
| GET | `/api/log/today` | exercises with last weight x reps prefilled |
| POST | `/api/log/sets` | log a set |
| DELETE | `/api/log/sets/{id}` | delete a set |
| GET | `/api/summary/weekly` | weekly summary |

Everything except onboarding needs `Authorization: Bearer <token>`.