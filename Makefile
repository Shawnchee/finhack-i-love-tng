SHELL := /usr/bin/env bash
ROOT  := $(shell pwd)
VENV  := $(ROOT)/.venv
PY    := $(VENV)/bin/python
PIP   := $(VENV)/bin/pip

PY_VERSION := 3.12

.PHONY: help install kill clean-venv

help:
	@echo "Setup:"
	@echo "  make install    — install python$(PY_VERSION) + overmind + create .venv + all deps"
	@echo "  make clean-venv — delete .venv (re-run make install after)"
	@echo ""
	@echo "Run:"
	@echo "  overmind start  — run all 3 backends + frontend (Ctrl+C kills all)"
	@echo ""
	@echo "Other:"
	@echo "  make kill       — free dev ports if something hangs"

install:
	@command -v python$(PY_VERSION) >/dev/null 2>&1 || { echo "Installing python@$(PY_VERSION) via brew..."; brew install python@$(PY_VERSION); }
	@command -v overmind >/dev/null 2>&1 || brew install overmind
	@if [ -x $(VENV)/bin/python ]; then \
		current=$$($(VENV)/bin/python --version 2>&1 | awk '{print $$2}'); \
		major_minor=$$(echo $$current | cut -d. -f1-2); \
		if [ "$$major_minor" != "$(PY_VERSION)" ]; then \
			echo "Existing .venv is python $$current — recreating with $(PY_VERSION)..."; \
			rm -rf $(VENV); \
		fi; \
	fi
	@if [ ! -x $(VENV)/bin/python ]; then \
		echo "Creating .venv with python$(PY_VERSION)..."; \
		python$(PY_VERSION) -m venv $(VENV); \
	fi
	$(PIP) install --upgrade pip
	$(PIP) install -r $(ROOT)/mule_check_api/requirements.txt
	$(PIP) install -e $(ROOT)/layer3-behavioral-fraud
	$(PIP) install -e $(ROOT)/fraud_detect_api
	$(PY) -m playwright install chromium
	cd $(ROOT)/frontend && npm install

clean-venv:
	rm -rf $(VENV)
	@echo "Removed $(VENV). Run 'make install' to rebuild."

kill:
	-@lsof -ti :8000 :8082 :8083 :5173 | xargs kill -9 2>/dev/null
	@echo "Freed dev ports."
