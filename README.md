# Family Tree Platform

A full-stack family tree application that runs on:
- Web (Expo web)
- Android (Expo)
- iOS (Expo)

It includes:
- A TypeScript API (`apps/api`) with Express + SQLite
- A cross-platform client (`apps/client`) built with Expo React Native
- Core family tree features: members, parent-child links, spouse links, and tree visualization

## Project Structure

- `apps/api`: REST API and local SQLite persistence
- `apps/client`: Expo app for web/android/ios

## Prerequisites

- Node.js 20+
- npm 10+
- Xcode (for iOS simulator) / Android Studio (for Android emulator) if running native simulators

## 1) Install dependencies

From repository root:

```bash
npm install
```

## 2) Configure environment

API:

```bash
cp apps/api/.env.example apps/api/.env
```

Client:

```bash
cp apps/client/.env.example apps/client/.env
```

Set `EXPO_PUBLIC_API_BASE_URL` in `apps/client/.env`:
- Web (same machine): `http://localhost:4000`
- iOS simulator: `http://localhost:4000`
- Android emulator: `http://10.0.2.2:4000`
- Physical device: `http://<your-local-ip>:4000`

## 3) Initialize and seed database

```bash
npm run db:init
npm run db:seed
```

## 4) Run app + API

```bash
npm run dev
```

This starts:
- API on `http://localhost:4000`
- Expo development server (choose web/android/ios from terminal prompt)

For direct web startup (API + web together):

```bash
npm run dev:web
```

## Useful Commands

```bash
npm run dev:api
npm run dev:client
npm run dev:web
npm run db:init
npm run db:seed
```

## API Endpoints

- `GET /health`
- `GET /api/tree`
- `POST /api/persons`
- `PUT /api/persons/:id`
- `DELETE /api/persons/:id`
- `GET /api/settings/ui`
- `PUT /api/settings/ui`
- `POST /api/relations/parent-child`
- `DELETE /api/relations/parent-child?parentId=<id>&childId=<id>`
- `POST /api/relations/spouse`
- `DELETE /api/relations/spouse?personAId=<id>&personBId=<id>`

## Notes

- Parent-child creation prevents cycles.
- Spouse links are normalized (A/B order) to avoid duplicates.
- Deleting a person cascades to their relationships.
- UI preferences (page/tab/theme/colors/navigation mode/sidebar state/photo visibility) are stored in SQLite and restored on restart.
