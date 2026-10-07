# Deployment architecture: cloud- and model-agnostic, Azure first

## The idea in one paragraph

The platform's value is the audit engine: modules, QA gates, citations,
hash-chained audit trail and content packs. That engine is plain
TypeScript in a single container. Everything that differs between
hyperscalers sits behind a small interface (a "port") with one adapter
per provider:
- the model that drafts;
- the database that stores state;
- the identity provider that signs users in;
- where secrets and logs live.

Moving to another cloud means choosing different adapters through
environment variables. It never means changing the engine.

```
                     ┌────────────────────── one container image ───────────────────────┐
 browser ── OIDC ──► │  UI (React)   API (Express)   Engine: modules · QA gates · trail   │
                     │                                                                    │
                     │  ports:   Identity      Model router        Store        Logs      │
                     └───────────────┬──────────────┬──────────────────┬───────────┬──────┘
                                     │              │                  │           │
            Azure (MVP)        Entra ID      Azure OpenAI,       PostgreSQL     Log Analytics
                                             Claude on Foundry   Flexible
            AWS                Cognito       Claude on Bedrock   RDS / Aurora   CloudWatch
            GCP                Identity Pl.  Claude on Vertex    Cloud SQL      Cloud Logging
            Private / on-prem  Keycloak,Okta vLLM / Ollama       PostgreSQL     stdout → any
```

## Ports and adapters

| Port | Configured by | Adapters available now | Code |
|---|---|---|---|
| Models | `LLM_DEFAULT`, `LLM_ROUTES` | `azure-openai`, `anthropic-foundry`, `anthropic-bedrock`, `anthropic-vertex`, `anthropic`, `openai-compatible` (vLLM, Ollama, LiteLLM, OpenAI), `offline` | `backend/src/engine/llm/` |
| Storage | `STORAGE`, `DATABASE_URL`, `DATABASE_AUTH` | `postgres` (password or Entra ID token), `json` (dev), `memory` (tests) | `backend/src/persistence/` |
| Identity | `AUTH_MODE`, `OIDC_*` | `oidc` (any OpenID Connect provider, roles from a token claim), `demo` | `backend/src/auth.ts`, `frontend/src/session.tsx` |
| Secrets | environment variables | Injected by the platform (Key Vault references, Secrets Manager, Secret Manager) or replaced by workload identity | — |
| Logs | stdout | Structured JSON lines, collected by every cloud's log service | `backend/src/server.ts` |
| Runtime | `PORT`, `STATIC_DIR` | One OCI image, non-root, `/api/healthz` and `/api/readyz` probes | `Dockerfile` |

### Model routing

Each module can use a different model, decided by evaluation rather than
assumption, as the OFI proposal requires:

```bash
LLM_DEFAULT=azure-openai>anthropic-foundry       # ">" = fallback chain
LLM_ROUTES=gaps:anthropic-foundry,report:azure-openai
```

Whatever the model, its output passes the same QA gates:
- it can only cite clauses from its grounding set;
- it can't call a control effective when exceptions were recorded;
- nothing is released without human sign-off.

The audit trail records the model that actually served each run. To
qualify a model or route before release, run
`npm run eval -- --provider <profile>`.

## Per-cloud mapping

| Concern | Azure (MVP, built) | AWS (next) | GCP (next) | Private / Kubernetes |
|---|---|---|---|---|
| Compute | Container Apps | App Runner or ECS Fargate | Cloud Run | Deployment + Service |
| Registry | Azure Container Registry | ECR | Artifact Registry | Harbor or any OCI registry |
| Database | Azure Database for PostgreSQL Flexible Server, Entra ID auth | RDS / Aurora PostgreSQL | Cloud SQL for PostgreSQL | PostgreSQL |
| Models | Azure OpenAI; Claude on Microsoft Foundry | Claude on Bedrock | Claude on Vertex AI | open-weight models via vLLM / Ollama |
| User sign-in | Entra ID (app roles) | Cognito or IAM Identity Center | Identity Platform / Google Workspace | Keycloak, Okta |
| Workload identity | User-assigned managed identity | IAM task role | Service account | Kubernetes service account |
| Secrets | Key Vault | Secrets Manager | Secret Manager | Vault / Kubernetes secrets |
| Logs | Log Analytics | CloudWatch Logs | Cloud Logging | Loki / ELK |
| Infrastructure as code | `infra/azure` (Terraform) | `infra/aws` (to build) | `infra/gcp` (to build) | Helm chart (to build) |

Small adapter additions still needed for AWS and GCP:
- **Database sign-in:** IAM token auth for RDS and Cloud SQL, alongside the
  existing Entra ID token auth.
- **Gemini:** an adapter if Gemini is wanted. Claude on Vertex already works.

Everything else is configuration.

## How this relates to the OFI proposal

The proposal (v1.0) chose Copilot Studio and Power Automate for
orchestration, with Dataverse for data. Those are Microsoft-only, so they
can't be the core of a cloud-agnostic product. This design keeps what the
proposal values and moves the orchestration into the portable engine:

| Proposal requirement | Where it lives here |
|---|---|
| Narrow modules, fixed output schemas, daisy-chaining | Engine modules with schema-validated output, chained scope → RCM → testing → gaps → report |
| Runtime QA gates before release | `backend/src/engine/qa.ts`, applied to model and rule output alike |
| Audit-trail bundle per execution | Hash-chained bundles; append-only table in PostgreSQL |
| Azure OpenAI primary, Claude via Foundry secondary, routing by configuration | `azure-openai` and `anthropic-foundry` profiles with per-module routes and fallback chains |
| Inside the client's tenant, Entra ID, managed identities, Key Vault, no new processors | `infra/azure`: everything in the client's subscription, no credentials in app settings |
| Evaluation set, pinned versions, change control | Evaluation harness, versions in every bundle, `backend/validation` |
| Teams as the front door | Next step: package the web app as a Teams tab, and/or expose the API to Copilot Studio as a connector. Teams becomes an entry point, not the engine. |
| Dataverse / Purview evidence | Next step: an export or write-back adapter to Dataverse or the client's GRC system. Purview can already govern the PostgreSQL server and Log Analytics. |

The proposal's own scorecard gives 5% to lock-in risk. It also says strong
evidence is "no proprietary hosting; portable module contracts;
multi-model capability". This design scores fully there. The trade-off is
that it is code the client or KDI must maintain, not low-code the client's
power-platform team can edit. The proposal also names "Azure AI Foundry
Agent Service / code-first" as its own escalation path, and this design is
that path taken from day one.

## Known MVP limits

- **Single replica:** the app keeps its working set in memory and writes
  through to PostgreSQL. Scaling out needs reads that go to the database and
  a database-side lock when sealing trail entries.
- **Networking:** PostgreSQL is reachable only by Azure services (firewall
  rule), not via private networking. Production should use VNet
  integration, private endpoints for PostgreSQL and Azure OpenAI, and
  internal ingress behind Front Door or Application Gateway.
- **Database privileges:** the app identity is the PostgreSQL Entra admin.
  Production should use a dedicated least-privilege role, with
  `INSERT`/`SELECT` only on `audit_trail`.
- **Untested against a real tenant:** `terraform validate` and offline plan
  tests pass, but nothing has been applied to a real Azure subscription
  yet. The model adapters are covered by tests against fakes; none has been
  called against a live endpoint.
