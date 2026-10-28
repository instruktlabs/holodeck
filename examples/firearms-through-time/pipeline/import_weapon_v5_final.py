import runpy
from pathlib import Path
R=Path(__file__).resolve().parent
runpy.run_path(str(R/'reimport_weapon_v5.py'))
runpy.run_path(str(R/'reimport_pistol_v5.py'))
