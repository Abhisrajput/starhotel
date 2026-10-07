# Validation package (skeleton)

The platform is designed to be qualified as a GxP computerised system. This folder
holds the skeleton of the validation package; the items marked *generated* are
produced from the code on every run so they cannot drift from the system.

| Deliverable | Status | Where |
|---|---|---|
| User requirements (URS) | Draft | `requirements.json` |
| Risk assessment | Draft | Risk column of `requirements.json`; see below |
| Requirements traceability matrix | *Generated* | `npm run traceability` -> `validation-output/traceability.md`, or `GET /api/validation/traceability` |
| OQ-style test evidence | *Generated* | `npm test` (tests tagged `[REQ-xx]`) |
| Performance / accuracy evidence | *Generated* | `npm run eval` -> `validation-output/eval-latest.md` |
| Audit trail integrity | *Generated* | `GET /api/trail/verify` |
| Change control procedure | Draft | below |
| IQ (installation) | To do | per client tenant deployment |
| PQ (on real client data) | To do | first reference client |

## Risk assessment approach

Requirements are rated by impact on the integrity of an audit conclusion:
**High** where a failure could release an incorrect, uncited or unauthorised
finding; **Medium** where a failure degrades control but another gate or a human
still catches it. Every High requirement must have automated test coverage and,
where relevant, evaluation-harness evidence.

## Change control for prompts, models and content

Prompts, model versions and content packs are configuration items:

1. Any change to a module prompt, the model ID (`ANTHROPIC_MODEL`), a QA gate, or a
   content pack bumps the relevant version (module `version`, `ENGINE_VERSION`, pack `version`).
2. `npm test` and `npm run eval -- --provider <provider>` must pass with no regression
   against the previous evaluation report before release.
3. Content-pack changes (clauses, citation maps, controls) require domain-expert
   review; set `reviewStatus` to `expert-reviewed` only after that review is recorded.
4. Every audit-trail bundle records the engine, module, pack and served-model
   versions, so any output can be traced to the configuration that produced it.
