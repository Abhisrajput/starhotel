output "app_url" {
  value = "https://${azurerm_container_app.main.ingress[0].fqdn}"
}

output "resource_group" {
  value = azurerm_resource_group.main.name
}

output "container_app" {
  value = azurerm_container_app.main.name
}

output "registry" {
  value = azurerm_container_registry.main.login_server
}

output "postgres_host" {
  value = azurerm_postgresql_flexible_server.main.fqdn
}

output "azure_openai_endpoint" {
  value = var.deploy_azure_openai ? azurerm_cognitive_account.openai[0].endpoint : null
}

output "app_identity_principal_id" {
  description = "Grant this identity 'Cognitive Services User' on a Microsoft Foundry resource to use Claude there."
  value       = azurerm_user_assigned_identity.app.principal_id
}
