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
- `GET /boost/payee` — Airtel / MTN number for a K50 boost
- `POST /boost/:serviceId` — use a credit, or send a payment SMS for admin review
- `GET /boost/pending` — admin boost queue
- `GET /admin/support-contact` — open a support chat
- `POST /notifications/test-self` — test ping
- `GET|POST /saved-searches` — notify me of new matches
- `GET /wanted` — open wanted-board posts
- `GET /wanted/mine` — your wanted posts (auth)
- `POST /wanted` — post what you need (auth)
- `PUT /wanted/:id/close` — mark found (owner)
- `DELETE /wanted/:id` — remove a post (owner)
- `GET /bookings` — your bookings as customer or vendor (auth)
- `POST /bookings` — book a service (auth)
- `PUT /bookings/:id/done` — mark a booking done
- `PUT /bookings/:id/cancel` — cancel a booking
- `GET|PUT /auth/vendor-profile` — shop name, photo, bio
- `POST /user-reports` — report a user
