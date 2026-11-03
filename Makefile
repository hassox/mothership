APP ?= $(HOME)/.config/herdr-app
LAYOUT := nested
MODS := $(notdir $(wildcard mods/*))

.NOTPARALLEL:
.PHONY: all layout launcher plugin $(MODS)

all: $(MODS) launcher plugin

nested-spaces: nested-agents nested-crew

$(MODS): layout
	sh scripts/install-mod.sh "$(APP)" $(LAYOUT) $@

layout:
	sh scripts/install-layout.sh "$(APP)" $(LAYOUT)

launcher:
	mkdir -p "$(HOME)/.local/bin"
	ln -sfn "$(CURDIR)/bin/herdr-org-launch" "$(HOME)/.local/bin/herdr-org-launch"

plugin:
	sh scripts/install-plugin.sh
