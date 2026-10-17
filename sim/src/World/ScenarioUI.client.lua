-- ScenarioUI (LocalScript in StarterPlayerScripts)
-- Operator panel, built in code. Hidden for judges who join as crew.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local control = ReplicatedStorage:WaitForChild("ScenarioControl")
local stateEvent = ReplicatedStorage:WaitForChild("ScenarioState")
local strikeHere = ReplicatedStorage:WaitForChild("StrikeHere")

local THEME = {
	panel = Color3.fromRGB(14, 16, 22),
	chip = Color3.fromRGB(34, 38, 48),
	accent = Color3.fromRGB(255, 184, 28),
	text = Color3.fromRGB(236, 238, 243),
	dim = Color3.fromRGB(138, 145, 160),
}
local SCENARIOS = {
	{ "storm_west", "Storm W" }, { "hurricane", "Hurricane" }, { "flash_flood", "Flash flood" },
	{ "heat_day", "Heat day" }, { "gator", "Gator" }, { "tipped", "Tipped pod" },
}
local SPEEDS = { 1, 10, 60, 120 }

-- DisplayOrder stays under FlashGui (1000) so the white flash covers the panel
local gui = Instance.new("ScreenGui")
gui.Name, gui.ResetOnSpawn, gui.DisplayOrder = "ScenarioUI", false, 10
gui.Parent = player:WaitForChild("PlayerGui")

local function round(inst, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, r)
	c.Parent = inst
end

local panel = Instance.new("Frame")
panel.AnchorPoint = Vector2.new(0, 1)
panel.Position = UDim2.new(0, 16, 1, -16)
panel.Size = UDim2.fromOffset(330, 0)
panel.AutomaticSize = Enum.AutomaticSize.Y
panel.BackgroundColor3, panel.BackgroundTransparency, panel.BorderSizePixel = THEME.panel, 0.1, 0
panel.Parent = gui
round(panel, 14)
local stroke = Instance.new("UIStroke")
stroke.Color, stroke.Transparency = Color3.new(1, 1, 1), 0.9
stroke.Parent = panel
local pad = Instance.new("UIPadding")
pad.PaddingTop, pad.PaddingBottom = UDim.new(0, 14), UDim.new(0, 14)
pad.PaddingLeft, pad.PaddingRight = UDim.new(0, 14), UDim.new(0, 14)
pad.Parent = panel
local list = Instance.new("UIListLayout")
list.Padding, list.SortOrder = UDim.new(0, 8), Enum.SortOrder.LayoutOrder
list.Parent = panel

local order = 0
local function add(inst)
	order += 1
	inst.LayoutOrder = order
	inst.Parent = panel
	return inst
end

local function text(size, font, color, height)
	local t = Instance.new("TextLabel")
	t.BackgroundTransparency = 1
	t.Size = UDim2.new(1, 0, 0, height)
	t.Font, t.TextSize, t.TextColor3 = font, size, color
	t.TextXAlignment, t.TextWrapped = Enum.TextXAlignment.Left, true
	t.Text = ""
	return add(t)
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
	b.TextColor3, b.BackgroundColor3, b.BorderSizePixel = THEME.text, THEME.chip, 0
	b.LayoutOrder = layoutOrder
	b.Parent = parent
	round(b, 8)
	b.MouseButton1Click:Connect(onClick)
	return b
end

local function setActive(b, on)
	b.BackgroundColor3 = on and THEME.accent or THEME.chip
	b.TextColor3 = on and THEME.panel or THEME.text
end

text(11, Enum.Font.GothamBold, THEME.dim, 14).Text = "SCENARIO CONTROL"
local title = text(17, Enum.Font.GothamBold, THEME.text, 22)
title.Text = "No scenario loaded"
local clock = text(30, Enum.Font.RobotoMono, THEME.accent, 34)
clock.Text = "--:--"
local status = text(12, Enum.Font.Gotham, THEME.dim, 16)

local scenarioGrid = grid(3, 30)
local scenarioChips = {}
for i, s in ipairs(SCENARIOS) do
	local key = s[1]
	scenarioChips[key] = chip(scenarioGrid, s[2], i, function() control:FireServer("load", key) end)
end

local current = { playing = false }
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
fp = chip(grid(1, 30), "Free play strike: off", 0, function()
	freePlay = not freePlay
	fp.Text = freePlay and "Free play strike: on, click the ground" or "Free play strike: off"
	setActive(fp, freePlay)
end)

local note = text(13, Enum.Font.Gotham, THEME.text, 0)
note.AutomaticSize = Enum.AutomaticSize.Y
note.Visible = false

local function clockText(st)
	local h, m = st.clockStart:match("(%d+):(%d+)")
	local minutes = tonumber(h) * 60 + tonumber(m) + st.simTime / 60
	return ("%02d:%02d"):format(math.floor(minutes / 60) % 24, math.floor(minutes % 60))
end

stateEvent.OnClientEvent:Connect(function(st)
	current = st
	if st.name and st.name ~= "" then
		title.Text = st.name
		clock.Text = clockText(st)
	end
	status.Text = ("%s  ·  %dx"):format(st.playing and "PLAYING" or "PAUSED", st.speed)
	playBtn.Text = st.playing and "Pause" or "Play"
	setActive(playBtn, st.playing)
	for key, b in pairs(scenarioChips) do setActive(b, key == st.key) end
	for s, b in pairs(speedChips) do setActive(b, s == st.speed) end
	note.Text = st.note or ""
	note.Visible = note.Text ~= ""
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
