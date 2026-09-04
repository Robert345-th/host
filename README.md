# ZedEvents API

Express + Postgres backend for ZedEvents.

Live: `https://zedevents-production.up.railway.app`

## Run locally

```bash
cd zedevents
npm install
# set DATABASE_URL (and other secrets) in .env
npm start
```

Default port is 3000.

## Notable routes

- `GET /services` — public feed (boosted first)
- `GET /reviews/leaderboard` — top vendors
- `GET|POST|DELETE /follows/:shopId` — follow a shop
- `GET /insights` — vendor views, chats, saves, followers
- `POST /boost/:serviceId` — use a credit or request a 24h boost
- `GET /boost/pending` — admin boost queue
- `GET|POST /saved-searches` — notify me of new matches
- `GET|PUT /auth/vendor-profile` — shop name, photo, bio
- `POST /user-reports` — report a user
