"""Replay the recorded 66-command session against both CLI assembly modes."""
import json
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

fixtures = Path(__file__).resolve().parent
repository = fixtures.parents[2]
commands = (fixtures / "integration-commands.txt").read_text(encoding="utf-8")
expected = json.loads((fixtures / "integration-expected.stdout.json").read_text(encoding="utf-8"))["stdout"]
expected_svg = (fixtures / "integration-expected.svg").read_text(encoding="utf-8")
record = json.loads((fixtures / "integration-result.json").read_text(encoding="utf-8"))
assert len(commands.splitlines()) == record["commandsPerMode"]
assert expected.count("svg> error:") == record["expectedErrorsPerMode"]
with tempfile.TemporaryDirectory(prefix="svg-report-integration-") as temporary:
    workspace = Path(temporary)
    (workspace / "assets").mkdir()
    for arguments in [[], ["--config", str(repository / "plugins.config.json")]]:
        completed = subprocess.run(
            ["node", str(repository / "dist/src/main.js"), *arguments],
            cwd=workspace, input=commands, text=True, encoding="utf-8",
            capture_output=True, check=True, timeout=20,
        )
        assert completed.stderr == "", completed.stderr
        assert completed.stdout == expected, "CLI stdout differs from recorded output"
        for name in ["session.svg", "final.svg"]:
            output = workspace / "assets" / name
            assert output.read_text(encoding="utf-8") == expected_svg, name
            output.unlink()
root = ET.fromstring(expected_svg)
elements = {element.get("id"): element for element in root.iter() if element.get("id")}
assert len(elements) == 10
assert (root.get("width"), root.get("height")) == ("1000", "800")
assert [elements["n-rect"].get(key) for key in ["x", "y", "width", "height", "fill"]] == ["100", "100", "80", "30", "#f5a623"]
assert [elements["r"].get(key) for key in ["x", "y", "width", "height"]] == ["15", "15", "30", "40"]
assert elements["n-label"].text == "完成"
assert elements["t"].text == "注释更新"
assert [child.get("id") for child in elements["bucket"]] == ["l"]
print("PASS: 66 commands per mode, 132 total; stdout, saved SVG and model content match")
