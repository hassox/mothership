import pathlib
import re
import shutil

shared = pathlib.Path("shared")
names = {f.name for f in shared.glob("*.js")}


def needed(main):
    want = set()

    def visit(path):
        for name in re.findall(r'from "\./([\w-]+\.js)"', path.read_text()):
            if name in names and name not in want:
                want.add(name)
                visit(shared / name)

    visit(main)
    return want


for meta in sorted(pathlib.Path("mods").glob("*/mod.json")):
    mod = meta.parent
    want = needed(mod / "main.js")
    for name in sorted(names):
        copy = mod / name
        if name in want:
            shutil.copyfile(shared / name, copy)
        elif copy.exists():
            copy.unlink()
    print(f"{mod.name}: {', '.join(sorted(want)) or 'none'}")
