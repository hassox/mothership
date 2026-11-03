import json
import pathlib
import sys

layout, mod = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
source = json.loads((mod / "mod.json").read_text()).get("cloned_from", {}).get("name")


def swap(node):
    if isinstance(node, dict):
        if source and node.get("mod") == source:
            node["mod"] = mod.name
        for value in node.values():
            swap(value)
    elif isinstance(node, list):
        for value in node:
            swap(value)


tree = json.loads(layout.read_text())
swap(tree)
layout.write_text(json.dumps(tree, indent=2) + "\n")
