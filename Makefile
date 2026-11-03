APP ?= $(HOME)/.config/herdr-app
LAYOUT := mothership
MODS := $(patsubst mods/%/mod.json,%,$(wildcard mods/*/mod.json))
UNMODS := $(addprefix uninstall-,$(MODS))

.NOTPARALLEL:
.PHONY: install layout launcher plugin $(MODS) uninstall uninstall-layout uninstall-launcher uninstall-plugin $(UNMODS)

install: $(MODS) launcher plugin

mothership-spaces: mothership-agents mothership-crew

$(MODS): layout
	sh scripts/install-mod.sh "$(APP)" $(LAYOUT) $@

layout:
	sh scripts/install-layout.sh "$(APP)" $(LAYOUT)

launcher:
	mkdir -p "$(HOME)/.local/bin"
	ln -sfn "$(CURDIR)/bin/herdr-org-launch" "$(HOME)/.local/bin/herdr-org-launch"

plugin:
	sh scripts/plugin.sh install

uninstall: uninstall-layout $(UNMODS) uninstall-launcher uninstall-plugin

uninstall-mothership-agents uninstall-mothership-crew: uninstall-mothership-spaces

$(UNMODS):
	sh scripts/uninstall-mod.sh "$(APP)" $(LAYOUT) $(@:uninstall-%=%)

uninstall-layout:
	sh scripts/uninstall-layout.sh "$(APP)" $(LAYOUT)

uninstall-launcher:
	[ "$$(readlink "$(HOME)/.local/bin/herdr-org-launch")" != "$(CURDIR)/bin/herdr-org-launch" ] || rm "$(HOME)/.local/bin/herdr-org-launch"

uninstall-plugin:
	sh scripts/plugin.sh uninstall
