# OmniRisk

You are working inside a four person hackathon repository. This file is the framework every session shares. It fixes what must be true (the requirements, the contracts between pieces, the demo) and leaves how to build each piece to the person who owns that folder, working with you. Read it, then read the CLAUDE.md in the folder you are working in, then the matching guide in docs/ if one exists.

## Purpose

Utility field crews get hurt by hazards that were knowable the night before, because the data lives in a dozen places and nobody turns it into a decision. We are building the platform that does, plus a physical beacon that puts the decision on the jobsite and makes stop work physically enforceable, plus a Roblox twin of the site where simulated storms strike the real device.

## What must be true at the demo (the definition of done)

1. The dashboard shows at least 50 real power plant sites on a map, ranked by a 0 to 10 hazard index from a trained model, each with live conditions merged from weather, heat, rain, soil, river, flood zone, lightning, and wildlife sources.
2. A lightning strike within 10 miles of a site creates a stop work alert with a 30 minute countdown that restarts on every new strike. A river site gets a flood warning after heavy rain. Heat index over the thresholds raises heat alerts.
3. Every evening at 6 PM in each site's local time a next day briefing is generated (English and Spanish) and can also be run on demand.
4. A crew member can take a photo of a hazard on their phone, it is tagged, pinned to the site map, and saved.
5. The physical beacon detects a lightning flash and thunder with its own sensors, computes the distance, cuts the equipment motor, shows the countdown on its 4 digit display and STOP WORK on its LCD, speaks the alert, and keeps doing all of this with no internet. A supervisor PIN entered on the IR remote restores power. Crew check in on the phone crew page (IR remote digit as backup), the beacon's 1 digit display shows the crew count, and the radar confirms the work zone is clear.
6. In the Roblox experience, pressing play on the storm scenario makes lightning strike in world, the screen flashes and thunder plays, the real beacon reacts (through its sensors and through the backend), the in world beacon mirrors the real one, and a judge who joins and walks into the work zone appears on the muster list.

If a task does not move one of those six forward, it waits.

## How we work

- This is a prototype built in about 30 hours. It will have bugs. A bug that does not affect the six points above is not fixed this weekend. Do not refactor, do not add tests beyond the TEST lines in the guides, do not gold plate.
- Prefer the fastest thing that works. If two approaches are close, pick the one with less code.
- Tools are suggestions, not orders. Each folder's CLAUDE.md names a suggested stack and the alternatives with their tradeoffs. When a choice is open, ask the human a short question with the pros and cons, agree in under five minutes, write the decision as one line at the bottom of that folder's CLAUDE.md under "Decisions", and move on.
- Contracts are not suggestions. Everything in contracts/ is how the pieces talk to each other. If you need to change one, stop, tell the human, they announce it in the team chat, and the change is a commit to contracts/ with the message starting "contract:". Never change a contract silently.
- Stay in your folder. Every folder has one owner (see README.md). backend and sim are each split between two owners at a boundary written in contracts/ (intel-interface.md and the Inside Roblox section of roblox-bridge.md). Do not edit another owner's folder. If you need something from it, ask.
- Every step ends with a test. The guides in docs/ have a TEST line after each step. Run it. If you cannot run it (no hardware here), say so and tell the human exactly what to run and what to expect.
- When something external disagrees with the guide (an API changed, a model id is different, a library renamed a function), trust the live documentation, fix it, and note it in the folder's CLAUDE.md under "Decisions".

## Git

Branches. `main` is demo ready and only receives merges from `dev`. `dev` is integration. All work happens on `feature/<area>-<thing>` branches created from `dev` (areas: core, intel, ml, web, sim, firmware, contracts).

Routine. Before starting, `git checkout dev && git pull`. Create your feature branch. Commit small and often with messages like `web: crew check in page`. When a feature works, merge `dev` into your branch, resolve anything, then merge your branch into `dev` and push. Merge to `dev` at least every few hours so nobody integrates at 2 AM. `dev` must always boot. Never force push, never rewrite history, never commit `.env`.

Parallel sessions. If the human is running more than one Claude Code session on this repo on the same machine, each session must be in its own git worktree so they do not overwrite each other. Check with `git worktree list`. If you are not in a worktree and another session is running, create one: `git worktree add ../beacon-<area> feature/<area>-<thing>` and work there. One worktree per branch.

Merging to main. Only the human merges `dev` into `main`, when the demo script runs end to end on `dev`.

## Contracts (read these before writing anything that crosses a folder)

- contracts/events.md, the one event shape every source writes
- contracts/serial.md, pod to Pi and Pi to UNO lines
- contracts/gateway-ws.md, the Pi to backend websocket messages
- contracts/api.md, REST and websocket routes
- contracts/intel-interface.md, how core calls intel
- contracts/roblox-bridge.md, how the Roblox experience talks to the backend
- contracts/env.md, every environment variable and who sets it

## Guides (read yours before your first task)

- docs/platform-guide.md, backend core (Viet)
- docs/ai-ml-guide.md, ml and backend intel (Chris)
- docs/web-guide.md, dashboard and crew page (Cam)
- docs/hardware-guide.md, pod, control box, Pi gateway (Slavik)
- docs/simulator-guide.md, Roblox World (Slavik) and Bridge (Viet)

## The demo script (what "working" means)

1. Roblox on one laptop, dashboard on another, the beacon on the table with the fan spinning, the beacon LCD showing ALL CLEAR with the hazard index and crew count.
2. Press play on Storm from the west. Sky darkens in Roblox, a bolt hits at 8 miles, the screen flashes, thunder rolls.
3. The beacon's photoresistor and the laptop mic catch it. The beacon says "Lightning detected, eight miles, stop work, clear the zone." The fan stops, the countdown starts on the display and the touchscreen, the equipment LCD says LOCKED OUT, the in world beacon turns red, the site jumps to the top of the ranked map.
4. A judge checks in on the phone crew page (or presses their number on the remote), the speaker confirms and the beacon's crew count goes up. A judge joins the Roblox experience on their phone and walks into the zone, and appears on the muster list. They step out, the zone reads clear.
5. A second strike at 6 miles resets the countdown. The supervisor presses OK, the four digit PIN, and OK on the remote; the fan restarts and the beacon LCD shows who released it.
6. Tomorrow's briefing is shown on the dashboard and spoken by the beacon (remote UP for English, DOWN for Spanish). The hazard index is shown with its three reasons.
7. The Pi's hotspot is turned off. A phone flashlight and a clap still stop the fan. Reconnect, and the event appears on the dashboard.

## Git is your job, not the human's

Run every git command yourself. Never tell the human to pull, branch, merge, or push. Do it, then report the result in one line. The only things you hand to the human are what this terminal cannot do: passwords and 2FA, clicking in a browser (Auth0, Tiger Cloud, Vultr, Figma, Roblox Studio), flashing or wiring hardware, and anything on the Pi that needs their hands. The committed .claude/settings.json pre-approves git, npm, pip, python, curl, docker, and ssh, so none of this should prompt. If a prompt appears anyway, the human accepts it with "yes, and don't ask again".

The routine.
1. Start of every session or task: `git fetch origin`. On dev, `git pull` and then create the feature branch. On a feature branch, `git merge origin/dev` so you have everyone's latest work before writing anything.
2. Every 30 to 45 minutes of work, and whenever the human says "sync": `git fetch origin && git merge origin/dev`, then one line on what changed outside your folder (`git diff --stat ORIG_HEAD HEAD`). This is how the team sees each other's work without anyone remembering to pull.
3. Commit after every step that passes its TEST, small, message prefixed with the area (core:, intel:, ml:, web:, sim:, firmware:, contract:, docs:).
4. When a feature works: `git fetch origin && git merge origin/dev`, run the TEST again, `git push -u origin HEAD`, then `git push origin HEAD:dev`. That fast forwards dev without checking it out, so it works in worktrees and never collides with another session. If the push to dev is rejected, someone landed first: fetch, merge, push again. Say in one line what landed so the human can post it in the team chat. If dev no longer boots after your merge, fixing it comes before anything else.
5. Conflicts. In files you own, resolve them. In files another owner owns, take dev's version (`git checkout --theirs <file>` while merging origin/dev) and tell the human. In contracts/, stop and tell the human, never resolve silently.
6. Never: force push, rebase a pushed branch, reset --hard, check out or push to main (Chris merges dev into main), commit .env or anything .gitignore covers, print the contents of .env.

## People

Chris owns backend/app/intel, ml, contracts, deploy. Viet owns backend/app/core and sim/src/Bridge. Cam owns web. Slavik owns sim/src/World, sim/place, and firmware. When in doubt about who to ask, ask Chris.
