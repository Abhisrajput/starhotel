# Azure MVP deployment

Terraform for the Azure MVP. Every resource is created inside the client's
own subscription:

| Resource | Purpose |
|---|---|
| Container Apps environment + app | Runs the single image (UI + API) |
| User-assigned managed identity | The app's only credential: pulls images and calls Azure OpenAI, Foundry and PostgreSQL |
| Azure Container Registry (Basic, admin off) | Image store; images are built in ACR, so no local Docker is needed |
| PostgreSQL Flexible Server 16 (B1ms) | State and the append-only audit trail; the app signs in with an Entra ID token |
| Azure OpenAI (keys disabled) + one model deployment | Primary drafting model |
| Key Vault (RBAC) | Break-glass DB admin password, plus any API keys you add |
| Log Analytics | Container logs (structured JSON) |

The architecture and the AWS/GCP equivalents are in
[`docs/deployment.md`](../../docs/deployment.md).

## Prerequisites

- An Azure subscription where you can create resources and role assignments
  (Owner, or Contributor + User Access Administrator).
- `az` CLI logged in (`az login`), Terraform ≥ 1.6.
- Azure OpenAI access in the chosen region. Check that `openai_model` is
  available there, or set `openai_location`.

## Deploy

```bash
cd infra/azure
cp terraform.tfvars.example terraform.tfvars   # set subscription_id, region, options
./deploy.sh
```

`deploy.sh` does three things:
1. `terraform apply` on the first run. The app starts on a placeholder image.
2. `az acr build` builds the platform image in your registry.
3. `terraform apply -var image=…` switches the app to that image with its
   full configuration.

It prints the app URL at the end. With `seed_demo = true` the two fictitious
demo engagements load on first start.

Later releases go through the **Deploy to Azure** GitHub workflow
(`.github/workflows/deploy-azure.yml`). It authenticates with GitHub OIDC
federated credentials, so no Azure secrets are stored in the repository.

## Turn on Entra ID sign-in (`auth_mode = "oidc"`)

The demo user switcher is for demos only. For real use, create **one app
registration**, for example `audit-platform`:

1. **Authentication → Add a platform → Single-page application**, redirect
   URI `https://<app url>/`.
2. **Expose an API**: set the Application ID URI and add a scope, e.g.
   `Audit.Access`.
3. **App roles**: create `Audit.Auditor`, `Audit.Reviewer` and
   `Audit.Approver` (member types: users/groups).
4. **Manifest**: set `"accessTokenAcceptedVersion": 2`. Tokens then carry
   the v2 issuer, with `aud` set to the app's client ID.
5. **API permissions**: add the `Audit.Access` scope and grant admin
   consent.
6. **Enterprise applications → the app → Users and groups**: assign people
   or groups to the three roles.

Then set in `terraform.tfvars`:

```hcl
auth_mode = "oidc"
oidc = {
  client_id = "<application (client) id>"
  audience  = "<application (client) id>"            # v2 access tokens
  scope     = "api://<application id uri>/Audit.Access"
}
```

The app maps the token's `roles` claim to auditor / reviewer / approver.
Anyone without a role is refused with 403.

## Use Claude through Microsoft Foundry

1. In the Foundry portal, deploy a Claude model in a Foundry resource. Use
   the same region, or another region approved for the data.
2. Give the app identity (output `app_identity_principal_id`) a data-plane
   role on that resource that allows model inference. Confirm the exact
   role name in Microsoft's Foundry documentation for Claude.
3. Set `anthropic_foundry_resource` (and `anthropic_foundry_model` if your
   deployment name differs), then choose routes. Some examples:

   ```hcl
   llm_default = "azure-openai>anthropic-foundry"   # Azure OpenAI, Claude as fallback
   llm_routes  = "gaps:anthropic-foundry"           # Gap Writer on Claude
   ```

Qualify each route with the evaluation harness before relying on it.

## Checks without an Azure subscription

```bash
terraform init -backend=false
terraform validate
terraform test        # offline plan tests with mocked providers (tests/plan.tftest.hcl)
```

## Hardening before production

- **Private networking:** a VNet-integrated Container Apps environment with
  internal ingress behind Front Door / Application Gateway (WAF);
  PostgreSQL with private access; private endpoints for Azure OpenAI, Key
  Vault and ACR (Premium SKU).
- **Database role:** a dedicated least-privilege PostgreSQL role for the
  app instead of the Entra admin, with `INSERT`/`SELECT` only on
  `audit_trail`.
- **Resilience:** zone-redundant PostgreSQL with geo-backup; Key Vault
  purge protection on.
- **Diagnostics:** route Container Apps, PostgreSQL and Azure OpenAI
  diagnostics to Log Analytics, and to Purview / Sentinel as the client
  requires.
- **State:** remote Terraform state (the `backend "azurerm"` block in
  `versions.tf`).
