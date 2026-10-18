-- ScenarioUI (LocalScript in StarterPlayerScripts)
-- The operator's control panel. Built in code, hidden for judges who join as crew. Sections: the sim clock and a
-- timeline with a tick for every strike, flood step, wildlife report, and note; the guided demo; the scenarios;
-- playback speed; free play lightning. Scales with the screen and collapses to its header.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local control = ReplicatedStorage:WaitForChild("ScenarioControl")
local stateEvent = ReplicatedStorage:WaitForChild("ScenarioState")
local strikeHere = ReplicatedStorage:WaitForChild("StrikeHere")

-- one theme for every PlanIT screen: panel, demo caption, zone card
local THEME = {
	panel = Color3.fromRGB(14, 16, 22),
	raised = Color3.fromRGB(30, 34, 44),
	line = Color3.fromRGB(255, 255, 255),
	accent = Color3.fromRGB(255, 184, 28),
	text = Color3.fromRGB(236, 238, 243),
	dim = Color3.fromRGB(138, 145, 160),
	red = Color3.fromRGB(255, 80, 80),
	blue = Color3.fromRGB(70, 150, 255),
	yellow = Color3.fromRGB(255, 210, 0),
}
local MARKER_COLOR = { strike = THEME.red, water = THEME.blue, wildlife = THEME.yellow, note = THEME.text }
local SCENARIOS = {
	{ "everglades_day", "Everglades day" }, { "lightning_cell", "Lightning cell" }, { "storm_west", "Storm W" },
	{ "hurricane", "Hurricane" }, { "flash_flood", "Flash flood" }, { "mississippi_flood", "River flood" },
	{ "heat_day", "Heat day" }, { "gator", "Gator" }, { "tipped", "Tipped pod" },
}
local SITES = { { "everglades", "Everglades jobsite" }, { "river", "Mississippi crossing" } }
local SPEEDS = { 10, 60, 120, 300 }

-- DisplayOrder stays under FlashGui (1000) so the white flash covers the panel
local gui = Instance.new("ScreenGui")
gui.Name, gui.ResetOnSpawn, gui.DisplayOrder = "ScenarioUI", false, 10
gui.Parent = player:WaitForChild("PlayerGui")

-- scale with the screen: full size on a laptop, smaller on a phone
local scale = Instance.new("UIScale")
scale.Parent = gui
local function rescale()
	local ok, size = pcall(function() return workspace.CurrentCamera.ViewportSize end)
	scale.Scale = math.clamp((ok and size.Y or 900) / 900, 0.65, 1)
end
if workspace.CurrentCamera then workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(rescale) end
rescale()

local function round(inst, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r)
	c.Parent = inst
end

local panel = Instance.new("Frame")
panel.AnchorPoint = Vector2.new(0, 1)
panel.Position = UDim2.new(0, 16, 1, -16)
panel.Size = UDim2.fromOffset(340, 0)
panel.AutomaticSize = Enum.AutomaticSize.Y
panel.BackgroundColor3, panel.BackgroundTransparency, panel.BorderSizePixel = THEME.panel, 0.08, 0
panel.Parent = gui
round(panel, 14)
local stroke = Instance.new("UIStroke")
stroke.Color, stroke.Transparency = THEME.line, 0.9
stroke.Parent = panel
local pad = Instance.new("UIPadding")
pad.PaddingTop, pad.PaddingBottom = UDim.new(0, 12), UDim.new(0, 14)
pad.PaddingLeft, pad.PaddingRight = UDim.new(0, 14), UDim.new(0, 14)
pad.Parent = panel
local list = Instance.new("UIListLayout")
list.Padding, list.SortOrder = UDim.new(0, 8), Enum.SortOrder.LayoutOrder
list.Parent = panel

local order = 0
local collapsible = {}
local function add(inst, keep)
	order += 1
	inst.LayoutOrder = order
	inst.Parent = panel
	if not keep then table.insert(collapsible, inst) end
	return inst
end

local function text(size, font, color, height, keep)
	local t = Instance.new("TextLabel")
	t.BackgroundTransparency = 1
	t.Size = UDim2.new(1, 0, 0, height)
	t.Font, t.TextSize, t.TextColor3 = font, size, color
	t.TextXAlignment, t.TextWrapped = Enum.TextXAlignment.Left, true
	t.Text = ""
	return add(t, keep)
end

local function grid(columns, height)
	local f = Instance.new("Frame")
	f.BackgroundTransparency = 1
	f.Size = UDim2.new(1, 0, 0, 0)
	f.AutomaticSize = Enum.AutomaticSize.Y
	local g = Instance.new("UIGridLayout")
	g.CellPadding = UDim2.fromOffset(6, 6)
	g.CellSize = UDim2.new(1 / columns, math.floor(-6 * (columns - 1) / columns), 0, height)
	g.SortOrder = Enum.SortOrder.LayoutOrder
	g.Parent = f
	return add(f)
end

local function chip(parent, label, layoutOrder, onClick)
	local b = Instance.new("TextButton")
	b.Text, b.Font, b.TextSize = label, Enum.Font.GothamMedium, 13
	b.TextColor3, b.BackgroundColor3, b.BorderSizePixel = THEME.text, THEME.raised, 0
	b.AutoButtonColor = true
	b.LayoutOrder = layoutOrder
	b.Parent = parent
	round(b, 8)
	b.MouseButton1Click:Connect(onClick)
	return b
end

local function setActive(b, on)
	b.BackgroundColor3 = on and THEME.accent or THEME.raised
	b.TextColor3 = on and THEME.panel or THEME.text
end

local function section(name)
	local t = text(11, Enum.Font.GothamBold, THEME.dim, 14)
	t.Text = name
	return t
end

---------------------------------------------------------------- header (always visible)

local header = Instance.new("Frame")
header.BackgroundTransparency, header.Size = 1, UDim2.new(1, 0, 0, 20)
add(header, true)
local brand = Instance.new("TextLabel")
brand.BackgroundTransparency, brand.Size = 1, UDim2.new(1, -30, 1, 0)
brand.Font, brand.TextSize, brand.TextColor3 = Enum.Font.GothamBold, 12, THEME.accent
brand.TextXAlignment, brand.Text = Enum.TextXAlignment.Left, "OMNIRISK  ·  SIM CONTROL"
brand.Parent = header
local collapsed = false
local collapseBtn
collapseBtn = chip(header, "–", 0, function()
	collapsed = not collapsed
	collapseBtn.Text = collapsed and "+" or "–"
	for _, inst in ipairs(collapsible) do inst.Visible = not collapsed end
end)
collapseBtn.AnchorPoint, collapseBtn.Position, collapseBtn.Size = Vector2.new(1, 0), UDim2.new(1, 0, 0, 0), UDim2.fromOffset(26, 20)

---------------------------------------------------------------- clock and timeline

local clockRow = Instance.new("Frame")
clockRow.BackgroundTransparency, clockRow.Size = 1, UDim2.new(1, 0, 0, 38)
add(clockRow)
local clock = Instance.new("TextLabel")
clock.BackgroundTransparency, clock.Size = 1, UDim2.new(0, 110, 1, 0)
clock.Font, clock.TextSize, clock.TextColor3 = Enum.Font.RobotoMono, 32, THEME.accent
clock.TextXAlignment, clock.Text = Enum.TextXAlignment.Left, "--:--"
clock.Parent = clockRow
local title = Instance.new("TextLabel")
title.BackgroundTransparency, title.Position, title.Size = 1, UDim2.fromOffset(112, 1), UDim2.new(1, -112, 0, 20)
title.Font, title.TextSize, title.TextColor3 = Enum.Font.GothamBold, 15, THEME.text
title.TextXAlignment, title.TextTruncate, title.Text = Enum.TextXAlignment.Left, Enum.TextTruncate.AtEnd, "No scenario loaded"
title.Parent = clockRow
local status = Instance.new("TextLabel")
status.BackgroundTransparency, status.Position, status.Size = 1, UDim2.fromOffset(112, 21), UDim2.new(1, -112, 0, 16)
status.Font, status.TextSize, status.TextColor3 = Enum.Font.Gotham, 12, THEME.dim
status.TextXAlignment, status.Text = Enum.TextXAlignment.Left, "PAUSED"
status.Parent = clockRow

local track = Instance.new("Frame")
track.BackgroundColor3, track.BorderSizePixel, track.Size = THEME.raised, 0, UDim2.new(1, 0, 0, 8)
add(track)
round(track, 4)
local fill = Instance.new("Frame")
fill.BackgroundColor3, fill.BackgroundTransparency, fill.BorderSizePixel = THEME.accent, 0.35, 0
fill.Size = UDim2.fromScale(0, 1)
fill.Parent = track
round(fill, 4)
local markerHolder = Instance.new("Frame")
markerHolder.BackgroundTransparency, markerHolder.Size = 1, UDim2.fromScale(1, 1)
markerHolder.Parent = track
local playhead = Instance.new("Frame")
playhead.AnchorPoint, playhead.Size = Vector2.new(0.5, 0.5), UDim2.fromOffset(4, 16)
playhead.Position = UDim2.fromScale(0, 0.5)
playhead.BackgroundColor3, playhead.BorderSizePixel, playhead.ZIndex = THEME.text, 0, 3
playhead.Parent = track
round(playhead, 2)

local drawnFor
local function drawMarkers(st)
	if drawnFor == st.key then return end
	drawnFor = st.key
	markerHolder:ClearAllChildren()
	if not st.markers or not st.duration or st.duration <= 0 then return end
	for _, m in ipairs(st.markers) do
		local tick = Instance.new("Frame")
		tick.AnchorPoint = Vector2.new(0.5, 0.5)
		tick.Position = UDim2.fromScale(m.t / st.duration, 0.5)
		tick.Size = m.type == "strike" and UDim2.fromOffset(3, 14) or UDim2.fromOffset(2, 10)
		tick.BackgroundColor3, tick.BorderSizePixel, tick.ZIndex = MARKER_COLOR[m.type] or THEME.dim, 0, 2
		tick.Parent = markerHolder
	end
end

-- the go/no-go call, a colored pill under the timeline
local DECISION_BG = {
	["GO"] = Color3.fromRGB(26, 110, 60), ["GO WITH CONTROLS"] = Color3.fromRGB(150, 100, 10), ["NO-GO"] = Color3.fromRGB(150, 28, 28),
}
local decision = text(13, Enum.Font.GothamBold, THEME.text, 0)
decision.AutomaticSize = Enum.AutomaticSize.Y
decision.BackgroundTransparency = 0
round(decision, 6)
local dpad = Instance.new("UIPadding")
dpad.PaddingTop, dpad.PaddingBottom, dpad.PaddingLeft, dpad.PaddingRight = UDim.new(0, 5), UDim.new(0, 5), UDim.new(0, 8), UDim.new(0, 8)
dpad.Parent = decision
local function paintDecision()
	local go = workspace:GetAttribute("GoNoGo") or "GO"
	local reasons = workspace:GetAttribute("GoReasons") or ""
	decision.Text = (workspace:GetAttribute("Tailboard") and "TAILBOARD  ·  " or "") .. go .. (reasons ~= "" and ("  ·  " .. reasons) or "")
	decision.BackgroundColor3 = DECISION_BG[go] or THEME.raised
end
for _, a in ipairs({ "GoNoGo", "GoReasons", "Tailboard" }) do workspace:GetAttributeChangedSignal(a):Connect(paintDecision) end
paintDecision()

---------------------------------------------------------------- demo, scenarios, playback

section("DEMO")
local current = { playing = false }
local demoBtn = chip(grid(1, 34), "Guided demo  ·  the Everglades day", 0, function() control:FireServer("demo") end)
demoBtn.Font, demoBtn.TextSize = Enum.Font.GothamBold, 14

section("SITE")
local siteGrid = grid(2, 30)
local siteChips = {}
for i, s in ipairs(SITES) do
	local key = s[1]
	siteChips[key] = chip(siteGrid, s[2], i, function() control:FireServer("site", key) end)
end
local function paintSites()
	local active = workspace:GetAttribute("ActiveSite") or "everglades"
	for key, b in pairs(siteChips) do setActive(b, key == active) end
end
workspace:GetAttributeChangedSignal("ActiveSite"):Connect(paintSites)
paintSites()

section("INSTANT")
local INSTANT = {
	{ "strike8", "Strike 8 mi W" }, { "strike6", "Strike 6 mi W" }, { "strike15", "Strike 15 mi W" },
	{ "heat", "Heat 115°F" }, { "flood", "Downpour + flood" }, { "wind", "High wind 45" },
	{ "gator", "Gator report" }, { "calm", "Reset to calm" },
}
local instantGrid = grid(2, 28)
for i, b in ipairs(INSTANT) do
	local key = b[1]
	local btn = chip(instantGrid, b[2], i, function() control:FireServer("instant", key) end)
	if key:sub(1, 6) == "strike" then btn.TextColor3 = THEME.red end
end

section("SCENARIOS")
local scenarioGrid = grid(3, 30)
local scenarioChips = {}
for i, s in ipairs(SCENARIOS) do
	local key = s[1]
	scenarioChips[key] = chip(scenarioGrid, s[2], i, function() control:FireServer("load", key) end)
end

section("PLAYBACK")
local transport = grid(5, 30)
local playBtn = chip(transport, "Play", 0, function()
	control:FireServer(current.playing and "pause" or "play")
end)
local speedChips = {}
for i, s in ipairs(SPEEDS) do
	speedChips[s] = chip(transport, s .. "x", i, function() control:FireServer("speed", s) end)
end

local freePlay = false
local fp
fp = chip(grid(1, 30), "Free play lightning: off", 0, function()
	freePlay = not freePlay
	fp.Text = freePlay and "Free play lightning: on, click the ground" or "Free play lightning: off"
	setActive(fp, freePlay)
end)

local note = text(13, Enum.Font.Gotham, THEME.text, 0)
note.AutomaticSize = Enum.AutomaticSize.Y
note.Visible = false

-- the shift log: every call and alert with its time, newest first, the record a safety manager files
section("SHIFT LOG")
local shiftLog = text(12, Enum.Font.RobotoMono, THEME.dim, 0)
shiftLog.AutomaticSize = Enum.AutomaticSize.Y
shiftLog.Text = "No entries yet"
local HttpService = game:GetService("HttpService")
local function paintLog()
	local ok, entries = pcall(HttpService.JSONDecode, HttpService, workspace:GetAttribute("ShiftLog") or "[]")
	if not ok or #entries == 0 then shiftLog.Text = "No entries yet" return end
	local shown = {}
	for i = 1, math.min(5, #entries) do table.insert(shown, entries[i]) end
	shiftLog.Text = table.concat(shown, "\n")
end
workspace:GetAttributeChangedSignal("ShiftLog"):Connect(paintLog)
paintLog()

---------------------------------------------------------------- state

local function clockText(st)
	local h, m = st.clockStart:match("(%d+):(%d+)")
	local minutes = tonumber(h) * 60 + tonumber(m) + st.simTime / 60
	return ("%02d:%02d"):format(math.floor(minutes / 60) % 24, math.floor(minutes % 60))
end

stateEvent.OnClientEvent:Connect(function(st)
	current = st
	local demo = workspace:GetAttribute("DemoMode") == true
	if st.name and st.name ~= "" then
		title.Text = st.name
		clock.Text = clockText(st)
	end
	status.Text = ("%s  ·  %dx%s"):format(st.playing and "PLAYING" or "PAUSED", st.speed, demo and "  ·  DEMO" or "")
	playBtn.Text = st.playing and "Pause" or "Play"
	setActive(playBtn, st.playing)
	for key, b in pairs(scenarioChips) do setActive(b, key == st.key and not demo) end
	for s, b in pairs(speedChips) do setActive(b, s == st.speed) end
	setActive(demoBtn, demo)
	drawMarkers(st)
	local p = (st.duration and st.duration > 0) and math.clamp(st.simTime / st.duration, 0, 1) or 0
	fill.Size = UDim2.fromScale(p, 1)
	playhead.Position = UDim2.fromScale(p, 0.5)
	note.Text = st.note or ""
	note.Visible = note.Text ~= "" and not collapsed
end)

local mouse = player:GetMouse()
UserInputService.InputBegan:Connect(function(input, processed)
	if processed or not freePlay then return end
	if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
		if mouse.Target then strikeHere:FireServer(mouse.Hit.Position) end
	end
end)

local function refresh() panel.Visible = player:GetAttribute("Operator") == true end
player:GetAttributeChangedSignal("Operator"):Connect(refresh)
refresh()
