# Azure MVP for the Audit & Controls Agent Platform.
#
#   Container Apps (one container: UI + API)  --managed identity-->  Azure OpenAI / Microsoft Foundry (Claude)
#          |                                   --Entra ID token-->   PostgreSQL Flexible Server (state + audit trail)
#          |                                   --AcrPull-->          Container Registry
#          +-- logs --> Log Analytics          Key Vault holds the break-glass DB password and any API keys
#
# No credentials are placed in app settings: the app's user-assigned identity
# authenticates to Azure OpenAI, Foundry and PostgreSQL.

data "azurerm_client_config" "current" {}

locals {
  base      = "${var.name}-${var.environment}"
  compact   = replace("${var.name}${var.environment}", "-", "")
  suffix    = substr(sha1("${data.azurerm_client_config.current.subscription_id}-${local.base}"), 0, 6)
  tags      = merge({ app = "audit-controls-platform", environment = var.environment }, var.tags)
  image     = var.image != "" ? var.image : "mcr.microsoft.com/k8se/quickstart:latest"
  bootstrap = var.image == ""
  db_name   = "audit"
}

resource "azurerm_resource_group" "main" {
  name     = "rg-${local.base}"
  location = var.location
  tags     = local.tags
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-${local.base}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_user_assigned_identity" "app" {
  name                = "id-${local.base}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = local.tags
}

# ---------- Container registry ----------

resource "azurerm_container_registry" "main" {
  name                = "cr${local.compact}${local.suffix}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = false
  tags                = local.tags
}

resource "azurerm_role_assignment" "app_acr_pull" {
  scope                = azurerm_container_registry.main.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

# ---------- Key Vault ----------

resource "azurerm_key_vault" "main" {
  name                       = "kv-${local.compact}-${local.suffix}"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  rbac_authorization_enabled = true
  purge_protection_enabled   = false
  tags                       = local.tags
}

resource "azurerm_role_assignment" "deployer_kv" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

resource "azurerm_role_assignment" "app_kv" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

# ---------- PostgreSQL (state and append-only audit trail) ----------

resource "random_password" "pg_admin" {
  length  = 32
  special = false
}

resource "azurerm_key_vault_secret" "pg_admin" {
  name         = "postgres-admin-password"
  value        = random_password.pg_admin.result
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_role_assignment.deployer_kv]
}

resource "azurerm_postgresql_flexible_server" "main" {
  name                          = "psql-${local.base}-${local.suffix}"
  resource_group_name           = azurerm_resource_group.main.name
  location                      = azurerm_resource_group.main.location
  version                       = "16"
  sku_name                      = var.postgres_sku
  storage_mb                    = 32768
  backup_retention_days         = 7
  administrator_login           = "pgadmin"
  administrator_password        = random_password.pg_admin.result
  public_network_access_enabled = true
  tags                          = local.tags

  authentication {
    active_directory_auth_enabled = true
    password_auth_enabled         = true
    tenant_id                     = data.azurerm_client_config.current.tenant_id
  }

  lifecycle {
    ignore_changes = [zone, high_availability]
  }
}

resource "azurerm_postgresql_flexible_server_database" "audit" {
  name      = local.db_name
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# MVP networking: Azure-internal traffic only. Production: VNet integration
# with a delegated subnet and private DNS (see README, "Hardening").
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure" {
  name             = "allow-azure-services"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# The app identity signs in to PostgreSQL with an Entra ID token, no password.
resource "azurerm_postgresql_flexible_server_active_directory_administrator" "app" {
  server_name         = azurerm_postgresql_flexible_server.main.name
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  object_id           = azurerm_user_assigned_identity.app.principal_id
  principal_name      = azurerm_user_assigned_identity.app.name
  principal_type      = "ServicePrincipal"
}

# ---------- Azure OpenAI ----------

resource "azurerm_cognitive_account" "openai" {
  count                 = var.deploy_azure_openai ? 1 : 0
  name                  = "oai-${local.base}-${local.suffix}"
  resource_group_name   = azurerm_resource_group.main.name
  location              = coalesce(var.openai_location, var.location)
  kind                  = "OpenAI"
  sku_name              = "S0"
  custom_subdomain_name = "oai-${local.base}-${local.suffix}"
  local_auth_enabled    = false # keys disabled: managed identity only
  tags                  = local.tags
}

resource "azurerm_cognitive_deployment" "chat" {
  count                = var.deploy_azure_openai ? 1 : 0
  name                 = var.openai_model.name
  cognitive_account_id = azurerm_cognitive_account.openai[0].id

  model {
    format  = "OpenAI"
    name    = var.openai_model.name
    version = var.openai_model.version
  }

  sku {
    name     = var.openai_model.sku
    capacity = var.openai_model.capacity
  }
}

resource "azurerm_role_assignment" "app_openai" {
  count                = var.deploy_azure_openai ? 1 : 0
  scope                = azurerm_cognitive_account.openai[0].id
  role_definition_name = "Cognitive Services OpenAI User"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

# ---------- Container Apps ----------

resource "azurerm_container_app_environment" "main" {
  name                       = "cae-${local.base}"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  tags                       = local.tags
}

locals {
  app_env = merge(
    {
      PORT          = "8080"
      STORAGE       = "postgres"
      DATABASE_URL  = "postgres://${azurerm_user_assigned_identity.app.name}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${local.db_name}"
      DATABASE_AUTH = "azure-ad"
      DATABASE_SSL  = "true"
      # Tells DefaultAzureCredential which user-assigned identity to use.
      AZURE_CLIENT_ID = azurerm_user_assigned_identity.app.client_id
      LLM_DEFAULT     = var.llm_default
      LLM_ROUTES      = var.llm_routes
      AUTH_MODE       = var.auth_mode
      SEED_DEMO       = tostring(var.seed_demo)
    },
    var.deploy_azure_openai ? {
      AZURE_OPENAI_ENDPOINT   = azurerm_cognitive_account.openai[0].endpoint
      AZURE_OPENAI_DEPLOYMENT = azurerm_cognitive_deployment.chat[0].name
    } : {},
    var.anthropic_foundry_resource != "" ? {
      ANTHROPIC_FOUNDRY_RESOURCE = var.anthropic_foundry_resource
      ANTHROPIC_FOUNDRY_MODEL    = var.anthropic_foundry_model
    } : {},
    var.auth_mode == "oidc" ? {
      OIDC_ISSUER    = "https://login.microsoftonline.com/${data.azurerm_client_config.current.tenant_id}/v2.0"
      OIDC_CLIENT_ID = var.oidc.client_id
      OIDC_AUDIENCE  = var.oidc.audience
      OIDC_SCOPE     = "openid profile email ${var.oidc.scope}"
    } : {},
  )
}

resource "azurerm_container_app" "main" {
  name                         = "ca-${local.base}"
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  tags                         = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  registry {
    server   = azurerm_container_registry.main.login_server
    identity = azurerm_user_assigned_identity.app.id
  }

  ingress {
    external_enabled = true
    target_port      = local.bootstrap ? 80 : 8080
    transport        = "auto"
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    # One replica for the MVP: the app keeps its working set in memory and
    # writes through to PostgreSQL. Scale-out needs the read-through store
    # described in docs/deployment.md.
    min_replicas = 1
    max_replicas = 1

    container {
      name   = "app"
      image  = local.image
      cpu    = 0.5
      memory = "1Gi"

      dynamic "env" {
        for_each = local.bootstrap ? {} : local.app_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "liveness_probe" {
        for_each = local.bootstrap ? [] : [1]
        content {
          transport = "HTTP"
          port      = 8080
          path      = "/api/healthz"
        }
      }

      dynamic "readiness_probe" {
        for_each = local.bootstrap ? [] : [1]
        content {
          transport = "HTTP"
          port      = 8080
          path      = "/api/readyz"
        }
      }
    }
  }

  depends_on = [
    azurerm_role_assignment.app_acr_pull,
    azurerm_postgresql_flexible_server_active_directory_administrator.app,
  ]
}
