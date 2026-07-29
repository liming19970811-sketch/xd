# Playwright Smoke

## Purpose

This folder contains a small local Playwright smoke suite for the H5 home page and result page flows. It is meant for quick local verification, not full end-to-end business coverage.

## Prerequisites

- Dependencies are installed:

```bash
npm install
```

- Playwright browser binaries are available locally.
  - Default local path in this project: `.ms-playwright`
  - If needed, set `PLAYWRIGHT_BROWSERS_PATH` to the correct location before running

## Start Local H5

Export H5 from HBuilderX first. This project currently uses HBuilderX export/release as the stable H5 build path.

The only local H5 output directory used for smoke verification is:

```text
unpackage/dist/build/web
```

There is no reliable `npm run build:h5` script in this project right now. `package.json` does not define `build:h5`, and the local install does not provide a `vue-cli-service` executable. After changing any H5-visible page, export H5 from HBuilderX again before running smoke tests. Do not validate against source files alone.

`serve:h5:local` serves `unpackage/dist/build/web` by default.

Start the local H5 server first:

```bash
npm run serve:h5:local
```

Default URL:

```text
http://127.0.0.1:8080/#/
```

If you need to serve a different H5 output directory, set `H5_ROOT` before starting the server.

## Run One Smoke

Home page smoke:

```bash
npm run test:playwright:h5-smoke
```

Result page smoke:

```bash
npm run test:playwright:result-smoke
```

Result page "Mark Needs Revision" smoke:

```bash
npm run test:playwright:result-needs-revision-smoke
```

Result page share click smoke:

```bash
npm run test:playwright:result-share-click-smoke
```

## Run All Smokes

Run the local aggregate entry:

```bash
npm run test:playwright:smoke-all
```

This runs, in order:

1. `h5-smoke.spec.js`
2. `result-smoke.spec.js`
3. `result-needs-revision-smoke.spec.js`
4. `result-share-click-smoke.spec.js`

## If Something Fails

Check these first:

1. Is `http://127.0.0.1:8080/#/` reachable in the browser?
2. Does the local H5 page open normally?
3. Is `PLAYWRIGHT_BROWSERS_PATH` correct?
4. Are Playwright browser files present under `.ms-playwright`?
