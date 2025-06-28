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

## 3. Build & watch TypeScript (hot reload)

```powershell
# Continuous compilation – every save re-emits JS to ./dist
npm run watch
```

The compiler writes JavaScript into `dist/`.  **SAM watches the compiled files**, so you do **not** need to rebuild the Docker containers manually.

---

## 4. Start the local API Gateway

Open a **new** terminal (leave the watcher running) and execute:

```powershell
# Build template + start api with hot containers
sam build --cached
sam local start-api --host 0.0.0.0 --port 3000 --warm-containers EAGER
```

**What this does**
* `sam build` picks up `dist/` and produces `.aws-sam/build/template.yaml` with **all Lambda memory & timeout values copied from CDK**.
* `sam local start-api` emulates API Gateway on <http://localhost:3000>.
* The `--warm-containers EAGER` flag gives you *hot-reload*: when code in `dist/` changes the corresponding container is replaced automatically.

You will see logs similar to:

```
Mounting RegisterDeviceFunction at http://0.0.0.0:3000/devices/register         [POST, OPTIONS]
...etc
```

---

## 5. Confirm it is working

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

## 6. CORS

Every Lambda uses `ResponseHandler` which automatically adds

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: *
```

That is enough for local testing.  If you need to tweak CORS further, edit the headers in `lambda/shared/response-handler.ts`.

---

## 7. Updating memory / timeout values

Memory and timeout are defined in **CDK** (`lib/lambda-functions-stack.ts`).
When you change them just re-run `sam build` – the generated template picks up the new values.

---

## 8. Cleaning up

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
| Function code not updating | Check the TypeScript watcher is running and `dist/` is receiving new `.js` files |

Happy coding! :rocket: 