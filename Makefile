# Auts Chrome Extension Makefile

.PHONY: help help-section
.PHONY: build build-crx dev preview
.PHONY: install add add-dev shadcn-init shadcn-add
.PHONY: clean
.PHONY: test

# ===========================================
# 🔧 Tooling Defaults
# ===========================================
# Detect Chrome/Chromium executable (override via: make build-crx CHROME=/path/to/chrome)
CHROME ?= $(shell \
	if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then \
		echo "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; \
	elif command -v google-chrome >/dev/null 2>&1; then \
		echo "google-chrome"; \
	elif command -v chromium >/dev/null 2>&1; then \
		echo "chromium"; \
	elif command -v chromium-browser >/dev/null 2>&1; then \
		echo "chromium-browser"; \
	else \
		echo ""; \
	fi \
)
# CRX output name prefix (override via: make build-crx CRX_NAME=my-ext)
CRX_NAME ?= auts-extension
# Optional key path to preserve extension ID (override via: make build-crx CRX_KEY=/abs/path/key.pem)
CRX_KEY ?=

# Default target
help: ## Show this help message
	@echo "🚀 Auts Chrome Extension - Build System"
	@echo "==============================="
	@$(MAKE) -s help-section SECTION="🔧 Development" PATTERN="build|dev|preview"
	@$(MAKE) -s help-section SECTION="📦 Package Management" PATTERN="install|add|add-dev|shadcn-init|shadcn-add"
	@$(MAKE) -s help-section SECTION="🧹 Utilities" PATTERN="clean"
	@$(MAKE) -s help-section SECTION="🧪 Testing" PATTERN="test"
	@$(MAKE) -s help-section SECTION="🎭 Playwright" PATTERN="pw-.*"

help-section:
	@echo ""
	@echo "$(SECTION):"
	@grep -E '^($(PATTERN)).*:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-18s %s\n", $$1, $$2}'

# ===========================================
# 🔧 Development
# ===========================================

build: ## Build Chrome Extension to dist/extension
	@echo "Building Chrome UI → dist/extension ..."
	@pnpm run build

build-crx: build ## Package dist/extension into a .crx (vars: CHROME, CRX_KEY, CRX_NAME)
	@echo "Packing CRX from dist/extension ..."
	@EXT_DIR="$(CURDIR)/dist/extension"; \
	if [ ! -f "$$EXT_DIR/manifest.json" ]; then \
		echo "Error: manifest.json not found. Run 'make build' first."; \
		exit 1; \
	fi; \
	if [ -z "$(CHROME)" ]; then \
		echo "Error: Chrome/Chromium not found. Override with CHROME=/path/to/chrome"; \
		exit 1; \
	fi; \
	OUT_DIR="$(CURDIR)/dist"; \
	TS=$$(date +%Y%m%d-%H%M%S); \
	KEY_OPT=""; \
	if [ -n "$(CRX_KEY)" ]; then KEY_OPT="--pack-extension-key=$(CRX_KEY)"; fi; \
	echo "Using Chrome: $(CHROME)"; \
	"$(CHROME)" --pack-extension="$$EXT_DIR" $$KEY_OPT >/dev/null 2>&1 || { echo "Error: Chrome pack failed."; exit 1; }; \
	SRC_CRX="$${EXT_DIR}.crx"; \
	mkdir -p "$$OUT_DIR"; \
	mv "$$SRC_CRX" "$$OUT_DIR/$(CRX_NAME)-$$TS.crx"; \
	if [ -z "$(CRX_KEY)" ] && [ -f "$${EXT_DIR}.pem" ]; then \
		mv "$${EXT_DIR}.pem" "$$OUT_DIR/$(CRX_NAME)-$$TS.pem"; \
	fi; \
	echo "✅ CRX: $$OUT_DIR/$(CRX_NAME)-$$TS.crx"; \
	if [ -f "$$OUT_DIR/$(CRX_NAME)-$$TS.pem" ]; then echo "🔑 Key: $$OUT_DIR/$(CRX_NAME)-$$TS.pem"; fi

dev: ## Watch build to dist/extension (Ctrl+C to stop)
	@echo "Watching Chrome Extension build → dist/extension ..."
	@pnpm run build -- --watch

preview: ## Preview UI standalone (Vite preview)
	@pnpm run preview

# ===========================================
# 📦 Package Management
# ===========================================

install: ## Install Chrome Extension dependencies
	@pnpm i

add: ## Add dependency to Chrome Extension (usage: make add PKG=package)
	@if [ -z "$(PKG)" ]; then \
		echo "Error: Please specify PKG, e.g. make add PKG=clsx"; \
		exit 1; \
	fi
	@pnpm i $(PKG)

add-dev: ## Add devDependency to Chrome Extension (usage: make add-dev PKG=@types/node)
	@if [ -z "$(PKG)" ]; then \
		echo "Error: Please specify PKG, e.g. make add-dev PKG=@types/node"; \
		exit 1; \
	fi
	@pnpm i -D $(PKG)

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



# ===========================================
# 🧪 Playwright Launcher
# ===========================================

.PHONY: pw-install pw-build pw-run

pw-install: install ## Install Playwright browsers (Chromium)
	@npx playwright install chromium

pw-build: ## Build extension to project root dist/extension via parent Makefile
	@$(MAKE) -C .. extension-build

pw-run: pw-build ## Launch Chromium with the built extension via Playwright script
	@node $(CURDIR)/tests/pw-run-extension.mjs

