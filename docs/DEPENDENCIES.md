# Dependency Management

This repository contains **two very different kinds of code**:

1. **Infrastructure code** (CDK): files under `bin/` and `lib/` that run **on your workstation or in CI** when you execute `cdk synth` / `cdk deploy`.
2. **Lambda application code**: TypeScript handlers under `lambda/**` that run **inside AWS Lambda** after CDK uploads them.

Because the two code paths are deployed differently, the way we declare and package dependencies is a little unusual.

---
## 1. How the tool-chain works – the short version

| Phase | What runs | Needs which dependencies? | Where do they come from? |
|-------|-----------|---------------------------|-------------------------|
| **A. TypeScript compile** | `npm run build` → `tsc` | _Type **definitions**_ for everything you `import` | Any package in **dependencies _or_ devDependencies** |
| **B. CDK synth / deploy** | `node bin/app.js` + `aws-cdk-lib` | Real JS for CDK libraries | Packages in **dependencies** (they reside in `node_modules` on _your_ machine) |
| **C. Bundling each Lambda** | A Docker container runs the `bundling.command` from `lib/lambda-functions-stack.ts` | Only the handler files you **explicitly copy** | Nothing from `node_modules` is copied! |
| **D. Runtime in AWS** | Node 22.x managed runtime | Built-in AWS SDK v3 and whatever you packaged | • Files you copied in phase C<br>• **Managed** `node_modules` that AWS provides |

**Key insight:**
> The zip that CDK uploads only contains whatever files you place in `/asset-output` during phase C. At the moment that is *just* `index.js` plus the helper files in `lambda/shared/` – **`node_modules` is completely absent.**


## 2. Adding a dependency **to one Lambda only**

### Scenario A – The dependency already exists in the Lambda runtime (example: any service client from AWS SDK v3)

1. Install it as a **dev dependency** so that TypeScript has the typings:
   ```powershell
   npm install --save-dev @aws-sdk/client-dynamodb
   ```
2. Import it in your handler:
   ```ts
   // lambda/register-device/index.ts
   import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
   ```
3. Deploy as usual – no changes to `lib/lambda-functions-stack.ts` are required because the code is **already present** in the managed runtime.

### Scenario B – The library is *not* present in the runtime (e.g. `uuid`, `lodash`)

Choose **one** of the following approaches:

**Option 1 – Bundle the module inside the zip**
1. Install the package **(devDependency)**:
   ```powershell
   npm i -D uuid
   ```
2. Update the `createBundledCode()` helper (one-time change) so that it copies the package folder:
   ```bash
   # inside the bundling command
   npm ci --omit=dev            # install prod deps
   cp -r node_modules/uuid /asset-output/node_modules/
   ```
3. Import and use `uuid` in the target Lambda.

**Option 2 – Use a Lambda Layer** (preferred for larger libs)
1. Create a folder (e.g. `layers/common-lib/nodejs/node_modules/uuid/**`).
2. Add a CDK `LayerVersion` that points at that folder.
3. Attach the layer **only** to the function(s) that need it.

---
## 3. Adding a dependency **to every Lambda**

If **all** functions need the same extra code (rare), the simplest path is to extend the bundling helper _once_:

1. Install the package at the root (devDependencies is fine):
   ```powershell
   npm i -D p-queue
   ```
2. Edit `createBundledCode()` so it copies the package for **every** function:
   ```bash
   npm ci --omit=dev
   cp -r node_modules/p-queue /asset-output/node_modules/
   ```
   Because the helper is reused for each Lambda, the library now ends up in all zips.

Alternative: build a **shared Lambda Layer** and attach it to every function.

---
## 4. How to know if a package is already in the runtime

DO NOT USE AWS SDK V3 FROM RUNTIME DUE TO UPDATES/DOWNTIME, IMPORT AS LAYER

The managed Node.js runtimes are intentionally minimal.  As of mid-2025 they contain:

* The **Node.js standard library** (built-ins such as `fs`, `path`, `crypto`, …)  
* The **AWS SDK v3** (all `@aws-sdk/*` clients). In the legacy 14.x/16.x runtimes the v2 SDK is present instead.  
* A few helper binaries used internally by Lambda.

Everything else (React, Lodash, `html-react-parser`, `uuid`, …) is **not** included.

### Three quick ways to verify

1. **AWS documentation** – the [Lambda runtimes page](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html) lists what is pre-installed.
2. **Local check with the public base image**
   ```bash
   docker run --rm -it public.ecr.aws/lambda/nodejs:22 bash
   node -e "require.resolve('@aws-sdk/client-dynamodb'); console.log('AWS SDK found')"
   node -e "require('html-react-parser');"   # ➜ throws MODULE_NOT_FOUND
   ```
3. **Inline console test** – create a scratch function in the AWS Console and `require()` the module in the editor; it will error if missing.

If the module is **not** built-in, use *Scenario B* above (bundle it or create a Layer).

---
## 5. FAQ

**Q: Won't adding a package to `devDependencies` bloat my deploy artefacts?**  
A: No. The bundling step never installs devDependencies, and right now it does not copy any `node_modules` at all.

**Q: Why not have per-Lambda `package.json` files?**  
A: They were useful when each function was packaged separately. Our unified bundling model makes them redundant and risks version drift, so we deleted them.

**Q: What if I need a newer version of the AWS SDK than the runtime ships?**  
A: Treat it like Scenario B – bundle or layer your chosen version.

---
Happy deploying! 🎉 