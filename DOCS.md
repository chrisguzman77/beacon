# DOCS.md, add the build guides and the kiosk contract to the repo

Run this once, from the repo root, after SETUP.md has been run and before the team starts their areas. Unzip beacon-docs.zip at the repo root first (it drops docs/, contracts/, and this file in place), then open Claude Code in the repo and say: "Execute DOCS.md top to bottom, then print the checklist."

## 1. Branch

```
git checkout dev && git pull
git checkout -b feature/contracts-docs
```

## 2. Files already in place from the zip

Confirm these exist and are non empty. Do not rewrite them.

```
docs/hardware-guide.md      Slavik, firmware
docs/platform-guide.md      Viet, backend core
docs/web-guide.md           Cam, web
docs/ai-ml-guide.md         Chris, ml and backend intel
docs/simulator-guide.md     Slavik (World) and Viet (Bridge), sim
contracts/kiosk-ws.md       new, Pi gateway to touchscreen kiosk page
contracts/gateway-ws.md     replaced, see its change log at the bottom
```

Remove `docs/.gitkeep` if present.

## 3. Small edits to existing files

Apply each exactly. If an old string is not found, print it and stop instead of guessing.

### CLAUDE.md (root)

Old:
```
- contracts/env.md, every environment variable and who sets it
```
New:
```
- contracts/env.md, every environment variable and who sets it
- contracts/kiosk-ws.md, the Pi gateway to touchscreen kiosk page messages (Slavik and Cam)

## Guides (read yours before your first task)

- docs/platform-guide.md, backend core (Viet)
- docs/ai-ml-guide.md, ml and backend intel (Chris)
- docs/web-guide.md, dashboard, crew page, kiosk (Cam)
- docs/hardware-guide.md, pod, control box, Pi gateway (Slavik)
- docs/simulator-guide.md, Roblox World (Slavik) and Bridge (Viet)
```

### backend/CLAUDE.md

Old:
```
Guide: docs/platform-guide.md (core) and docs/ai-ml-guide.md section 6 and 7 (intel), when they land.
```
New:
```
Guide: docs/platform-guide.md (core, follow its Build order paragraph, not the section numbers) and docs/ai-ml-guide.md (intel). Viet's Roblox Bridge is docs/simulator-guide.md section 4.
```

### web/CLAUDE.md

Old:
```
Fixed: the routes above, the API and websocket contracts in contracts/api.md, the kiosk's seven screens (status, crew, stop work, supervisor PIN, briefing, report, health) described in docs/hardware-guide.md Appendix C when it lands, and that the stop work screen cannot be dismissed by touch.
```
New:
```
Fixed: the routes above, the API and websocket contracts in contracts/api.md, the kiosk websocket in contracts/kiosk-ws.md, the kiosk's seven screens (status, crew, stop work, supervisor PIN, briefing, report, health) described in docs/web-guide.md section 9, and that the stop work screen cannot be dismissed by touch.

Guide: docs/web-guide.md. Section 2 is the Figma conversation to have first.
```

### sim/CLAUDE.md

Old:
```
Guide: docs/simulator-guide.md (Roblox version) when it lands.
```
New:
```
Guide: docs/simulator-guide.md. Sections 1 to 3 and 5 to 7 are Slavik's, section 4 is Viet's. Viet's FakeBridge (section 4.2) is the first commit in src/Bridge so the World has attributes to react to.
```

### firmware/CLAUDE.md

Old:
```
Suggested: pyserial, websockets, gpiozero, FastAPI for the kiosk server, pygame or aplay for audio. Pre rendered WAV clips for the fixed voice lines.
```
New:
```
Suggested: pyserial, websockets, gpiozero, FastAPI for the kiosk server, pygame or aplay for audio. Pre rendered WAV clips for the fixed voice lines.

Guide: docs/hardware-guide.md. Appendix D is the gateway program map and its local rules. The kiosk page's messages are contracts/kiosk-ws.md, and Cam's kiosk build is copied to firmware/gateway/kiosk/ (gitignored, see below).
```

### .gitignore

Append:
```
# model files are committed only here
!backend/app/intel/model/*.joblib
!backend/app/intel/model/schema.json
# kiosk build is copied onto the Pi by hand, not committed
firmware/gateway/kiosk/
firmware/gateway/queue.jsonl
firmware/gateway/crew.json
```

### contracts/api.md

Old:
```
POST /checkin                                  crew/sup    {site_id, action, lat, lon, via}
```
New:
```
POST /checkin                                  crew/sup    {site_id, action, lat, lon, via}   (kiosk check ins arrive on the gateway websocket instead, see gateway-ws.md)
```

## 4. Commit and merge

Two commits so the contract change is visible on its own in the log.

```
git add contracts/
git commit -m "contract: gateway-ws checkin carries crew_id and via, CREW down, pin ok; add kiosk-ws" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01UeSrjvwKUWuhQUyStecC3Z"
git add -A
git commit -m "docs: build guides for hardware, platform, web, ai-ml, simulator (Roblox); point area CLAUDE.md files at them" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01UeSrjvwKUWuhQUyStecC3Z"
git checkout dev
git merge --ff-only feature/contracts-docs
git push origin dev
git branch -d feature/contracts-docs
```

## 5. Checklist

Print each with PASS or FAIL.

- `git log --oneline -3` on dev shows the two commits above.
- docs/ has five .md files and no .gitkeep.
- contracts/ has nine files.
- `grep -c kiosk-ws CLAUDE.md` is at least 1.
- `git check-ignore firmware/gateway/kiosk/x` prints the path.
- `git status` is clean.

Then tell the human: "Docs are on dev. Tell the team to `git pull` and each read the root CLAUDE.md, their area CLAUDE.md, and their guide before the first task. Post GATEWAY_TOKEN, SIM_TOKEN, and the public backend address in the chat once they exist."
