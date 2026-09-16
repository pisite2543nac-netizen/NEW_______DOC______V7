# V18.7.3 One-Click Installer Fix

The V18.7.2 installer could stop at `git clone` on Windows PowerShell 5.1 after printing only `Cloning into ...`.
Git writes normal progress to STDERR. With `$ErrorActionPreference = 'Stop'`, PowerShell 5.1 may surface that STDERR as `NativeCommandError` even when it is not a Git failure.

V18.7.3 changes `Invoke-Native` so native STDERR is captured and logged without becoming a terminating PowerShell error. The installer now decides success/failure from `$LASTEXITCODE`, adds `git ls-remote` as a read-only connectivity/authentication preflight, and keeps full output in `UPDATE_LOG_*.txt` for a real failure.

Application source remains the V18.7 full package. Only the installer/reliability layer is revised.
