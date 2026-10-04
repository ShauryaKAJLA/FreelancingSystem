# Working in a sandbox with no MongoDB (npm may or may not work)

**Phase 3 update:** in the Phase 3 session `npm install` DID work in both `backend/` and `frontend/` (registry allowed), so the real test suite (`npm test`), `vite build` and `eslint` could be run directly. MongoDB was still unavailable (only the npm/pip/GitHub hosts are reachable, not mongodb.org), so `mongodb-memory-server` could not download its binary. Check `npm install` first; fall back to the shim below only if it 403s.


The build environment used for Phases 1–2 could not `npm install` (403) and had no MongoDB. What worked:

1. **Pure logic first.** Put validators, query builders and state-transition rules in plain functions (see `buildOpenJobsQuery`, `rules` in `jobService.js`) and test them with `node --test`.
2. **Stubbed-model service tests.** `t.mock.method(Model, 'findById', async () => fakeDoc)` — services are written so each Mongoose call can be stubbed (fake docs need `set()`/`save()` if the service calls them).
3. **Local mongoose shim (verification only, never shipped).** Create `/tmp/fakemods/mongoose/index.js` exporting `isValidObjectId`, a `Schema` class (with `Types.ObjectId`, `index()`, `set()`), `Types.ObjectId`, and `model(name)` returning a class whose static methods (`find, findOne, findById, findOneAndUpdate, findByIdAndUpdate, findByIdAndDelete, create, exists, countDocuments, aggregate, deleteOne, updateOne, insertMany`) throw "not stubbed". Then: `NODE_PATH=/tmp/fakemods node --test tests/<file>.test.js`. (Tests that need `bcryptjs`/`express` won't run there — they need a real `npm install`.)
4. **Frontend syntax check without node_modules:** `esbuild <file> --loader:.js=jsx --log-level=error >/dev/null` (a copy exists under the global `tsx` package) or copy to `/tmp/x.mjs` and `node --check`.
5. Anything requiring real Mongo (aggregations like discovery, transactions in `acceptBid`, unique/partial indexes) must be listed as **not verified** and covered by the `scripts/smoke-phaseN.sh` acceptance script for the user to run.


## Phase 4 addition: HTTP-level tests without MongoDB
`tests/phase4.routes.test.js` starts the REAL Express app (`http.createServer(require('../src/app'))` on port 0) and stubs only the Mongoose models with `t.mock.method(Model, 'findById', ...)` (stub `User.findById` so `authenticate` works with a `signToken` JWT; use a small chainable stand-in for `find().sort().limit()`). This proves route order, role gates, validators, envelopes and the raw-body webhook with no database. Copy it for Phases 5-6. Note `fetch` sends the exact bytes you pass as `body`, so webhook-signature tests can use deliberately odd spacing.

## Phase 5-6 addition: shims that worked when `npm install` returned 403
`/tmp/fakemods/mongoose/index.js` (see recipe above; `Schema` needs `index/set/pre/virtual` no-ops, `Types.ObjectId`, `isValidObjectId` regex, `model()` with throwing statics) **plus** `/tmp/fakemods/dotenv/index.js` (`module.exports={config(){return {}}}`). Run `NODE_PATH=/tmp/fakemods node --test tests/<file>.test.js`. Everything that does not import `express`/`bcryptjs` loads (services, validators, dto, controllers' pure parts). Use a `chain(rows)` stand-in for `find().sort().skip().limit().select()`.
