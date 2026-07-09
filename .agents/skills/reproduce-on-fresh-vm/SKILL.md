---
name: reproduce-on-fresh-vm
description: >
  Use when fixing ANY bug reported against the zosma-cowork desktop app (or any
  packaged Tauri/desktop app) that involves install/permissions/packaging/OS
  behaviour — anything not reproducible in `tauri dev`. Reproduce the bug in a
  FRESH throwaway VM matching the reporter's OS (Windows or Linux), capture a
  BEFORE screenshot of the failure, apply the fix, rebuild the real installable
  artifact, capture an AFTER screenshot of it working in the same VM, and embed
  both in the PR body. Triggers: "reproduce the bug", "test on a VM", "code 243",
  "extension install fails", "only happens after install", "works in dev but not
  the released build", "verify the fix in a VM".
---

# Reproduce-and-verify on a fresh throwaway VM

**Iron rule for packaged/install/OS bugs:** never claim a fix works from code
reasoning or a dev-mode run alone. Reproduce the failure in a clean VM that
matches the reporter's OS, then prove the fix in that same VM with **before +
after** screenshots pasted into the PR body. Dev mode (`tauri dev`) does NOT use
the bundled Node/npm or the root-owned system install dir, so it silently hides
this entire bug class.

## 0. Decide the target OS from the report

Look at the reported screenshot/log path:
- `/usr/lib/zosma-cowork/...`  → **Linux** (`.deb` / AppImage system install).
- `C:\Program Files\...` or `node.exe` / `ERROR_BAD_EXE_FORMAT` → **Windows**.
- macOS `/Applications/...` → macOS.

Build + reproduce on that OS. (The root cause is often cross-platform, but the
reporter's OS is what you must show green.)

## 1. Get the REAL installable artifact (don't hand-run source)

Prefer CI over a local Tauri build (no local Rust/webkit toolchain needed):

```bash
# staging-build.yml builds macOS/Linux/Windows installers + uploads artifacts.
gh workflow run staging-build.yml --repo CelestialCreator/zosma-cowork \
  --ref <your-fix-branch> -f ref=<your-fix-branch>
# watch it
gh run list --repo CelestialCreator/zosma-cowork --workflow=staging-build.yml --limit 1
```

Download the artifact zip via the API (plain `gh run download` may error
"path traversal" on these artifacts):

```bash
RUN=<run-id>
gh api repos/CelestialCreator/zosma-cowork/actions/runs/$RUN/artifacts \
  -q '.artifacts[] | "\(.name) id=\(.id)"'
gh api repos/CelestialCreator/zosma-cowork/actions/artifacts/<id>/zip > a.zip
unzip -o -j a.zip '*.deb' -d .        # or *.AppImage / *.msi / *.exe
```

**Sanity-check the fix is actually in the shipped bundle** before trusting the VM:
```bash
dpkg-deb -x zosma-cowork_*_amd64.deb ext
grep -c "<your fix marker>" ext/usr/lib/zosma-cowork/agent-sidecar/index.cjs
```

For a BEFORE artifact, dispatch the same workflow on the PARENT commit / `main`,
or build it before landing the fix.

## 2. Boot a fresh throwaway VM (with a display)

### Linux (QEMU/KVM — fast, deb-based, has webkit)
Use Xubuntu live (deb-based, light XFCE, ships libwebkit2gtk-4.1):
```bash
DIR=/home/zosma/vms/linux-throwaway; mkdir -p $DIR/share
curl -sL -o $DIR/xubuntu.iso \
  https://cdimage.ubuntu.com/xubuntu/releases/24.04/release/xubuntu-24.04.3-desktop-amd64.iso
qemu-system-x86_64 -name zc-linux-test -enable-kvm -cpu host -smp 2 -m 6144 \
  -drive file=$DIR/xubuntu.iso,media=cdrom,readonly=on -boot d \
  -device virtio-net,netdev=n0 -netdev user,id=n0,hostfwd=tcp::2223-:22 \
  -virtfs local,path=$DIR/share,mount_tag=hostshare,security_model=none,id=hostshare \
  -vga virtio -display vnc=127.0.0.1:1 -usb -device usb-tablet -machine q35 &
# VNC on 127.0.0.1:5901. Drop the .deb into $DIR/share to hand it to the guest.
```
Live session runs the .deb install via `sudo` → app lands in **root-owned
`/usr/lib/zosma-cowork`**, exactly reproducing the reported condition, while the
GUI runs as the normal user.

### Windows
Reuse the existing libvirt `win11-testing` VM (see `~/mini-devops` + wiki
`win11-testing-vm-*`) or clone a fresh one. Install path is
`C:\Program Files\zosma-cowork` (non-writable for standard users), which
reproduces the same permission class of bug.

## 3. Drive the GUI headlessly (VNC automation)

Use `vncdotool` (host venv) for click/type/capture:
```bash
python3 -m venv $DIR/venv && $DIR/venv/bin/pip install vncdotool
VD="$DIR/venv/bin/vncdotool -s 127.0.0.1::5901"
$VD move X Y click 1        # click
$VD type "lowercase-cmd"    # type
$VD key enter               # keypress
$VD capture /tmp/shot.png   # screenshot -> read it back to see state
```

**CRITICAL vncdotool gotcha:** `type` does NOT apply Shift — `~`→backtick,
`&`→7, `_`→hyphen, uppercase letters break. Write guest commands using
**lowercase + only unshifted chars** (`/ - . = space` are fine). Practical
tricks: mount 9p at `/tmp/sh` (`sudo mount -t 9p -o trans=virtio hostshare
/tmp/sh`), **rename the artifact host-side to avoid underscores** (e.g.
`zc.deb`), and verify paths with `find <dir> -maxdepth N -name pi-web-access`
instead of typing `node_modules`.

Xubuntu-specific: open a terminal via the Whisker menu — `$VD move 12 12 click
1; $VD type "terminal"; $VD key enter`.

## 4. Reproduce BEFORE, then prove AFTER — screenshot both

1. Install the **unfixed** artifact, drive to the failing action, capture the
   error (or use the reporter's original screenshot as the BEFORE if identical).
2. Install the **fixed** artifact in a clean VM, repeat the exact action,
   capture success. Also capture filesystem proof from the guest terminal
   (where the write landed vs. the old failing path).

## 5. Put before/after in the PR body

Commit the PNGs to the branch under `.pr-assets/<slug>/` (separate
`docs(pr):` commit — not shipped code) and reference them by raw URL so they
render cross-repo (fork branch → upstream PR):

```
https://raw.githubusercontent.com/CelestialCreator/zosma-cowork/<branch>/.pr-assets/<slug>/<file>.png
```

Edit the PR body via the API (plain `gh pr edit` can abort on a GraphQL
"Projects classic deprecated" error):
```bash
gh api -X PATCH repos/zosmaai/zosma-cowork/pulls/<N> -F body=@/tmp/body.md
```

## 6. Hand off + clean up
Leave the VM running (VNC `127.0.0.1:5901`; open for the user with
`remote-viewer vnc://127.0.0.1:5901`) so the reporter can verify manually.
Only tear down (`kill` the qemu + viewer PIDs, remove the ISO/share) after
they confirm.

## Reference: the canonical case
`code 243` extension-install bug (PR #331). Exit 243 = npm `EACCES`
(errno −13 → 256−13). Bundled Node in root-owned `/usr/lib/zosma-cowork/binaries`
→ npm derives global prefix from the binary location → writes to root-owned
`.../lib/node_modules` → denied. Fix pins `npm_config_prefix` to
`~/.zosma-cowork/npm-global`. See wiki `obs-2026-07-09-extension-code-243-*` and
memex `cowork-extension-install-eacces-243`.
