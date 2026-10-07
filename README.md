# Audit & Controls Agent Platform — MVP

A generic internal-audit and quality-audit platform for regulated manufacturing
(food, pharma, and any manufacturer through the common pack). This MVP follows the
KDI product thesis: **a thin, portable engine plus vertical content packs**, with
QA gates and an evidence trail built in from day one.

```
                 ┌──────────────────────── Engine (thin, portable) ────────────────────────┐
 Scope           │  Risk & Scope  →  Control & Risk  →  Testing   →  Gap Writer  →  Report   │
 statement  ───► │   Analysis         Writer (RCM)     (TOD/TOE)    (findings)     Writer    │ ──► Report (.md)
                 │      │                 │                │             │             │       │ ──► Findings CSV for
                 │      └──── QA gates on every output: citation · evidence · triple ───┘       │     QMS / GRC write-back
                 │            citation · release · library-only · consistency                │
                 │  Grounding index (BM25, clause-level)   Model router (offline | Claude)    │
                 │  Hash-chained audit trail: every module run and every human sign-off      │
                 └─────────────────────────────────────────────────────────────────────────┘
                       ▲ content packs (data, not code)                    ▲ evaluation harness
             common · food · pharma  (clauses, controls, eval cases)        + validation package
```

Screenshots: [scope](docs/screenshots/scope.png) · [findings & sign-off](docs/screenshots/findings.png) · [audit trail](docs/screenshots/audit-trail.png) · [evaluation & validation](docs/screenshots/validation.png)

## What is in the MVP

| Thesis component | Where | Status |
|---|---|---|
| Module orchestration (daisy-chaining) | `backend/src/engine/modules/*`, `service.ts` | 5 modules, chain order enforced |
| Runtime QA gates | `backend/src/engine/qa.ts` | Citation, evidence, triple-citation, release, consistency, library-only |
| Audit-trail bundle per execution | `backend/src/engine/trail.ts` | Inputs, retrieval set, log, QA actions, output, versions, actor; SHA-256 chained |
| Grounding index with clause metadata | `backend/src/engine/grounding.ts` | BM25 keyword index; swap for vector search later |
| Model routing, model-agnostic | `backend/src/engine/llm/*` | Azure OpenAI, Claude (Anthropic API, Foundry, Bedrock, Vertex), OpenAI-compatible (vLLM/Ollama) or offline rules; per-module routes and fallback chains |
| Cloud-agnostic runtime | `Dockerfile`, `backend/src/persistence`, `backend/src/auth.ts` | One container; PostgreSQL (append-only trail) or JSON; OIDC sign-in (Entra ID, Cognito, Google, Okta) |
| Azure deployment | `infra/azure` | Terraform: Container Apps, PostgreSQL (Entra auth), Azure OpenAI, Key Vault, ACR, managed identity; CI/CD workflows |
| Common pack (RCM, TOD/TOE, gap writer) | `backend/packs/common` | COSO-based P2P, ITGC, **treasury & commodity hedging**, governance |
| Food pack | `backend/packs/food` | HACCP verification, supplier/co-man, traceability & recall, allergens, PRPs |
| Pharma pack | `backend/packs/pharma` | GMP self-inspection: QU, training, deviations/CAPA, batch release, data integrity, lab, change control, suppliers |
| Human-in-the-loop sign-off | `service.ts#signOff` | Auditor → Reviewer → Approver, separate people, signature manifestation |
| Evaluation harness | `backend/src/eval` | 25 expert-labelled cases across packs, used as release gate |
| Validation package skeleton | `backend/validation` | URS, risk ratings, generated traceability matrix, change-control procedure |
| Integration posture | `GET /api/engagements/:id/findings.csv` | Flat export for write-back; no system-of-record ambitions |

All demo data is fictitious. **Clause summaries are paraphrased and marked `draft`.**
They have not had domain-expert review yet, and they are not the authoritative
regulatory text. That review is a workstream in the thesis and must happen before
any client use.

## Quick start

Requires Node 20+ (tested on 22).

```bash
# API (port 3002)
cd backend
npm install
npm run seed        # two demo engagements: food+treasury, and pharma GMP
npm run dev

# UI (port 5174), in a second terminal
cd frontend
npm install
npm run dev         # open http://localhost:5174
```

Or run the production setup locally, the same container and PostgreSQL the
cloud deployment uses: `docker compose up --build` from the repo root. The UI is
then on http://localhost:8080.

To deploy to Azure, see [`infra/azure/README.md`](infra/azure/README.md). For
the cloud- and model-agnostic architecture and its AWS/GCP equivalents, see
[`docs/deployment.md`](docs/deployment.md).

### Demo script (≈10 minutes)

1. **Engagements**: open *H1 2026 Food Safety & Commodity Risk Audit*.
2. **Risk & scope**: the control library is ranked against the scope statement.
   Each control has a rationale and clause citations. Untick a row and save; the
   decision lands in the audit trail.
3. **RCM**: each control comes with risk, sample size by frequency and risk,
   TOD/TOE steps, a checklist and citations.
4. **Fieldwork & testing**: record a test with exceptions but no evidence reference,
   then run Testing and see the evidence gate downgrade it.
5. **Findings**: findings are drafted with the 5 C's and a triple citation
   (clause + control + evidence). Switch *Acting as* to Reviewer and sign, then to
   QA Head and approve. A finding with no evidence reference is **blocked** and
   cannot be signed.
6. **Report**: only approved findings are included. Download the `.md` report or the
   CSV for QMS/GRC write-back.
7. **Audit trail**: open any bundle to see exactly what the module saw and decided.
   *Verify hash chain* proves nothing was altered.
8. **Content library**: browse packs and try the grounding search, e.g. "audit trail
   not reviewed".
9. **Evaluation & validation**: run the harness and review the requirements
   traceability matrix.

## Choosing models

By default every module runs on deterministic rules (`LLM_DEFAULT=offline`). That
needs no key and gives reproducible output. Pick a model profile per environment,
and optionally per module:

| Profile | Settings |
|---|---|
| `azure-openai` | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`; API key or managed identity |
| `anthropic-foundry` | `ANTHROPIC_FOUNDRY_RESOURCE`; API key or managed identity |
| `anthropic` | `ANTHROPIC_API_KEY` (model defaults to `claude-opus-5-5`) |
| `anthropic-bedrock` | `AWS_REGION`; IAM role |
| `anthropic-vertex` | `VERTEX_PROJECT_ID`; service account |
| `openai-compatible` | `OPENAI_BASE_URL`, `OPENAI_MODEL` (vLLM, Ollama, LiteLLM, OpenAI) |

```bash
LLM_DEFAULT='azure-openai>anthropic-foundry' LLM_ROUTES='gaps:anthropic-foundry' npm run dev
npm run eval -- --provider azure-openai     # qualify a model against the eval set before use
```

The model only drafts. Every model output passes through the same QA gates as the
offline rules:

- It can only pick controls that exist in the library.
- It can only cite clauses from the grounding set it was given.
- It cannot call a control effective when exceptions were recorded.
- Its output cannot be released without human sign-off.

If every provider in a chain fails or declines, the module falls back to the
deterministic rules and records a QA flag. The audit trail records the model that
actually served each request.

## Adding a sector or regulation

Create `backend/packs/<id>/pack.json` with:

- `clauses`: id, regulation, ref, title, paraphrased summary, tags and `reviewStatus`.
- `controls`: risk, objective, frequency, `clauseRefs`, TOD/TOE steps, evidence,
  checklist and recommendation.
- `evalCases`: expected retrieval hits, test conclusions and finding citations.
- `sources`: short citation prefixes.

The pack is schema-validated on load, and a control that cites an unknown clause is
rejected. No engine code changes are needed.

## Checks

```bash
cd backend
npm test              # 39 tests incl. real PostgreSQL and OIDC, tagged [REQ-xx]
npm run eval          # 25/25 eval cases (offline) -> validation-output/eval-latest.md
npm run traceability  # requirements traceability matrix -> validation-output/traceability.md
npm run typecheck
```

## Not in the MVP (next steps)

- **Expert review of the content:** clause summaries and citation maps (especially
  the Schedule M section numbering, and the FSSAI and BRCGS mappings) need an ex-QA
  head or food-safety lead to sign them off.
- **Real evidence ingestion:** evidence is recorded as references today. Next is
  reading SOPs, deviations and CAPAs from an eQMS (Veeva, MasterControl, TrackWise)
  and attaching documents.
- **E-signatures:** Part 11-grade e-signatures (re-authentication at signing) on
  top of the OIDC sign-in.
- **Scale-out and private networking:** see "Known MVP limits" in
  [`docs/deployment.md`](docs/deployment.md).
- **AWS and GCP infrastructure as code:** the adapters exist; `infra/aws` and
  `infra/gcp` are still to be written.
- **Further modules:** pharma deviation/CAPA effectiveness review, ALCOA+
  data-integrity audit, food supplier audit modules, Audit Committee pack.
- **Validation:** IQ/PQ in a client environment, and full change control over
  prompts and models.
