# Auts Chrome Extension Makefile

.PHONY: help help-section
.PHONY: build dev preview
.PHONY: install add add-dev shadcn-init shadcn-add
.PHONY: clean
.PHONY: test

# Default target
help: ## Show this help message
	@echo "🚀 Auts Chrome Extension - Build System"
	@echo "==============================="
	@$(MAKE) -s help-section SECTION="🔧 Development" PATTERN="build|dev|preview"
	@$(MAKE) -s help-section SECTION="📦 Package Management" PATTERN="install|add|add-dev|shadcn-init|shadcn-add"
	@$(MAKE) -s help-section SECTION="🧹 Utilities" PATTERN="clean"
	@$(MAKE) -s help-section SECTION="🧪 Testing" PATTERN="test"

help-section:
	@echo ""
	@echo "$(SECTION):"
	@grep -E '^($(PATTERN)).*:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-18s %s\n", $$1, $$2}'

# ===========================================
# 🔧 Development
# ===========================================

build: ## Build Chrome Extension to dist/extension
	@echo "Building Chrome UI → dist/extension ..."
	@npm run build

dev: ## Watch build to dist/extension (Ctrl+C to stop)
	@echo "Watching Chrome Extension build → dist/extension ..."
	@npm run build -- --watch

preview: ## Preview UI standalone (Vite preview)
	@npm run preview

# ===========================================
# 📦 Package Management
# ===========================================

install: ## Install Chrome Extension dependencies
	@npm i

add: ## Add dependency to Chrome Extension (usage: make add PKG=package)
	@if [ -z "$(PKG)" ]; then \
		echo "Error: Please specify PKG, e.g. make add PKG=clsx"; \
		exit 1; \
	fi
	@npm i $(PKG)

add-dev: ## Add devDependency to Chrome Extension (usage: make add-dev PKG=@types/node)
	@if [ -z "$(PKG)" ]; then \
		echo "Error: Please specify PKG, e.g. make add-dev PKG=@types/node"; \
		exit 1; \
	fi
	@npm i -D $(PKG)

shadcn-init: ## Initialize shadcn UI (interactive)
	@npx shadcn@latest init

shadcn-add: ## Add shadcn components (usage: make shadcn-add C="button input dialog")
	@if [ -z "$(C)" ]; then \
		echo "Error: Please specify C (components), e.g. make shadcn-add C=\"button input\""; \
		exit 1; \
	fi
	@npx shadcn@latest add $(C)

# ===========================================
# 🧹 Utilities
# ===========================================

clean: ## Clean Chrome Extension build cache
	@rm -rf node_modules/.vite
	@rm -rf dist

# ===========================================
# 🧪 Testing & Quality
# ===========================================

test: ## Run Chrome Extension tests (placeholder)
	@echo "No tests configured yet."


