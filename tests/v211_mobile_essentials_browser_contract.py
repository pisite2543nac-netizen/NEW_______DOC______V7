from pathlib import Path
import runpy
print('Compatibility: V21.3 removed sidebar; running current navigation contract')
runpy.run_path(str(Path(__file__).with_name('v213_no_sidebar_stability_browser_contract.py')),run_name='__main__')
