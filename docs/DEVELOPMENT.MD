# Local Development Guide

This short guide shows **one simple way** to run the entire Acorn-Pups API locally with hot-reload, CORS support and the same memory / timeout settings defined in CDK.

---

## 1. Prerequisites

1. **Node.js 22** and **npm ≥10** – already required by the repo.
2. **Docker Desktop** – SAM uses Docker to emulate Lambda.
3. **AWS SAM CLI** – https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
4. (Optional) **`concurrently`** `npm i -g concurrently` – lets you run the TypeScript watcher and SAM together in one terminal.

---

## 2. Install dependencies

```powershell
npm install
```

---

## 3. One-command hot-reload dev server

Everything now runs via a single script that watches TypeScript, rebuilds the SAM artefacts and restarts containers when code changes.

```powershell
npm run dev
```

Behind the scenes `npm run dev` does three things in parallel (see `package.json`):

1. `npm run watch` – incremental TypeScript compile to `dist/`.
2. Watches `dist/**/*.js` with `chokidar` and triggers `sam build --parallel` after every change (fast, incremental build).
3. Runs `sam local start-api --host 0.0.0.0 --port 3000`.

Because containers are **not** kept warm, each HTTP request spins up a fresh container that always reflects the latest code.

You'll see three colour-coded panes in your terminal: **TS**, **BUILD**, and **SAM**.

---

## 4. Confirm it is working

```powershell
curl http://localhost:3000/health
```

Expected response (200):

```json
{"status":"healthy", "timestamp":"2025-01-01T00:00:00.000Z", ...}
```

> Tip – use the **sample event payloads** in `docs/events/` to invoke a single Lambda:
> ```powershell
> sam local invoke RegisterDeviceFunction --event docs/events/register-device.json
> ```

---

## 5. CORS

Every Lambda uses `ResponseHandler` which automatically adds

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: *
```

That is enough for local testing.  If you need to tweak CORS further, edit the headers in `lambda/shared/response-handler.ts`.

---

## 6. Updating memory / timeout values

Memory and timeout are defined in **CDK** (`lib/lambda-functions-stack.ts`).
When you change them just let `npm run dev` rebuild – the generated template picks up the new values automatically.

---

## 7. Cleaning up

```powershell
# Stop the API (Ctrl+C) then remove containers & artefacts if you like
sam local stop-api  # ⬅ only if running in the background
Remove-Item .aws-sam -Recurse -Force
```

---

### Troubleshooting

| Problem | Fix |
|---------|------|
| `sam` command not found | Verify SAM CLI is installed & in PATH |
| Docker permission denied | Make sure Docker Desktop is running |
| Function code not updating | Make sure `npm run dev` is still running and the **BUILD** pane is rebuilding without errors |

Happy coding! :rocket: 