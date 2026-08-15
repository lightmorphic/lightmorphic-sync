# Lightmorphic Sync

Self-hostable, zero-knowledge sync server for [Lightmorphic Browser](https://github.com/lightmorphic/lightmorphic-browser).

Two small services:

- **`sync-api`** &mdash; stores end-to-end encrypted blobs (bookmarks, quick-paste snippets, settings, extensions list) per account. It never sees a passphrase or an encryption key &mdash; only an `accountId` and `authKey`, both independently derived client-side from the user's passphrase. See [`extension/sync/crypto.js`](https://github.com/lightmorphic/lightmorphic-browser/blob/main/extension/sync/crypto.js) in the browser repo for the derivation. There is no password recovery: losing the passphrase loses the data.
- **`webstore-proxy`** &mdash; reverse-proxies the Chrome Web Store's gallery/update/download endpoints, so a Lightmorphic Browser install talks to your proxy instead of Google directly. Your proxy's own IP is still visible to Google &mdash; this hides the end user, not the operator.

## Self-hosting

```bash
git clone https://github.com/lightmorphic/lightmorphic-sync.git
cd lightmorphic-sync
docker compose up -d
```

That exposes `sync-api` on `:4081` and `webstore-proxy` on `:4082`. Put a reverse proxy with TLS in front of both for real use, then point your Lightmorphic Browser build's sync settings and `--apps-gallery-*` launcher flags at your own domain instead of the default hosted service.

Persistent data lives in `./data/sync-api` (bind mount) &mdash; back that directory up like any other database.

## API

| Method | Path | Auth | |
|---|---|---|---|
| POST | `/v1/register` | &mdash; | `{ accountId, authKey }` &rarr; `{ token }` |
| POST | `/v1/login` | &mdash; | `{ accountId, authKey }` &rarr; `{ token }` |
| GET | `/v1/collections/:name` | Bearer | &rarr; `{ blob, version }` |
| PUT | `/v1/collections/:name` | Bearer | `{ blob, baseVersion }` &rarr; `{ version }`, `409` on conflict |
| DELETE | `/v1/account` | Bearer | deletes the account and all its data |

`:name` is one of `bookmarks`, `snippets`, `settings`, `extensions`.

## License

GPL-3.0-or-later.
