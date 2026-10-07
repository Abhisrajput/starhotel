# Offline plan tests with mocked providers: `terraform test` needs no Azure credentials.

mock_provider "azurerm" {
  mock_data "azurerm_client_config" {
    defaults = {
      subscription_id = "00000000-0000-0000-0000-000000000000"
      tenant_id       = "11111111-1111-1111-1111-111111111111"
      object_id       = "22222222-2222-2222-2222-222222222222"
    }
  }
}
mock_provider "random" {}

variables {
  subscription_id = "00000000-0000-0000-0000-000000000000"
}

run "bootstrap_uses_placeholder_image" {
  command = plan

  assert {
    condition     = azurerm_container_app.main.template[0].container[0].image == "mcr.microsoft.com/k8se/quickstart:latest"
    error_message = "First apply should run the placeholder image."
  }
  assert {
    condition     = azurerm_container_app.main.ingress[0].target_port == 80
    error_message = "Placeholder image listens on port 80."
  }
}

run "app_configuration" {
  command = plan

  variables {
    image = "crauditctldev.azurecr.io/audit-platform:abc123"
  }

  assert {
    condition     = azurerm_container_app.main.ingress[0].target_port == 8080
    error_message = "App listens on 8080."
  }
  assert {
    condition     = contains([for e in azurerm_container_app.main.template[0].container[0].env : "${e.name}=${e.value}"], "STORAGE=postgres")
    error_message = "App must use PostgreSQL."
  }
  assert {
    condition     = contains([for e in azurerm_container_app.main.template[0].container[0].env : "${e.name}=${e.value}"], "DATABASE_AUTH=azure-ad")
    error_message = "App must sign in to PostgreSQL with its managed identity."
  }
  assert {
    condition     = length([for e in azurerm_container_app.main.template[0].container[0].env : e if can(regex("(?i)(password|api_key|secret)", e.name))]) == 0
    error_message = "No credentials in app settings."
  }
  assert {
    condition     = azurerm_container_app.main.template[0].max_replicas == 1
    error_message = "MVP runs a single replica."
  }
  assert {
    condition     = azurerm_cognitive_account.openai[0].local_auth_enabled == false
    error_message = "Azure OpenAI keys must be disabled."
  }
  assert {
    condition     = azurerm_container_registry.main.admin_enabled == false
    error_message = "Registry admin user must be disabled."
  }
}

run "oidc_and_foundry" {
  command = plan

  variables {
    image                      = "crauditctldev.azurecr.io/audit-platform:abc123"
    auth_mode                  = "oidc"
    oidc                       = { client_id = "spa-client", audience = "api://audit-platform", scope = "api://audit-platform/Audit.Access" }
    anthropic_foundry_resource = "kdi-foundry"
    llm_routes                 = "gaps:anthropic-foundry"
    deploy_azure_openai        = false
    llm_default                = "anthropic-foundry"
  }

  assert {
    condition     = contains([for e in azurerm_container_app.main.template[0].container[0].env : "${e.name}=${e.value}"], "OIDC_ISSUER=https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/v2.0")
    error_message = "Issuer must be the tenant's Entra ID v2 endpoint."
  }
  assert {
    condition     = contains([for e in azurerm_container_app.main.template[0].container[0].env : "${e.name}=${e.value}"], "ANTHROPIC_FOUNDRY_RESOURCE=kdi-foundry")
    error_message = "Foundry resource must reach the app."
  }
  assert {
    condition     = length(azurerm_cognitive_account.openai) == 0
    error_message = "Azure OpenAI is optional."
  }
}
