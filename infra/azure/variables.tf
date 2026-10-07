variable "subscription_id" {
  description = "Azure subscription to deploy into (or set ARM_SUBSCRIPTION_ID)."
  type        = string
  default     = null
}

variable "name" {
  description = "Short name used in resource names (lowercase letters and digits)."
  type        = string
  default     = "auditctl"
  validation {
    condition     = can(regex("^[a-z][a-z0-9]{2,11}$", var.name))
    error_message = "Use 3-12 lowercase letters or digits, starting with a letter."
  }
}

variable "environment" {
  description = "Environment suffix, e.g. dev, test, prod."
  type        = string
  default     = "dev"
}

variable "location" {
  description = "Azure region for all resources (choose one approved for the client's data residency)."
  type        = string
  default     = "centralindia"
}

variable "openai_location" {
  description = "Region for Azure OpenAI if the model is not offered in var.location. Defaults to var.location."
  type        = string
  default     = null
}

variable "image" {
  description = "Container image to run. Leave empty on the very first apply; CI pushes the real image to the registry and updates the app."
  type        = string
  default     = ""
}

# ---------- Models ----------

variable "deploy_azure_openai" {
  description = "Create an Azure OpenAI account and model deployment."
  type        = bool
  default     = true
}

variable "openai_model" {
  description = "Azure OpenAI model to deploy. Check regional availability before changing."
  type = object({
    name     = string
    version  = string
    sku      = string
    capacity = number
  })
  default = {
    name     = "gpt-4.1"
    version  = "2025-04-14"
    sku      = "GlobalStandard"
    capacity = 50
  }
}

variable "llm_default" {
  description = "Model profile for all modules: offline | azure-openai | anthropic-foundry | 'a>b' fallback chain."
  type        = string
  default     = "azure-openai"
}

variable "llm_routes" {
  description = "Per-module overrides, e.g. \"gaps:anthropic-foundry\"."
  type        = string
  default     = ""
}

variable "anthropic_foundry_resource" {
  description = "Microsoft Foundry resource name hosting a Claude deployment (created in the Foundry portal). Empty to skip."
  type        = string
  default     = ""
}

variable "anthropic_foundry_model" {
  description = "Claude deployment name in Microsoft Foundry."
  type        = string
  default     = "claude-opus-5-5"
}

# ---------- Identity ----------

variable "auth_mode" {
  description = "demo (header-based demo users; never for real data) or oidc (Microsoft Entra ID)."
  type        = string
  default     = "demo"
  validation {
    condition     = contains(["demo", "oidc"], var.auth_mode)
    error_message = "auth_mode must be demo or oidc."
  }
}

variable "oidc" {
  description = "Entra ID app registration used when auth_mode = oidc. See README for the app roles to create."
  type = object({
    client_id = string
    audience  = string
    scope     = string
  })
  default = {
    client_id = ""
    audience  = ""
    scope     = ""
  }
}

variable "seed_demo" {
  description = "Load the fictitious demo engagements into an empty database on first start."
  type        = bool
  default     = true
}

variable "postgres_sku" {
  description = "PostgreSQL Flexible Server SKU."
  type        = string
  default     = "B_Standard_B1ms"
}

variable "tags" {
  type    = map(string)
  default = {}
}
