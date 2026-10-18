-- LightningRadar (LocalScript in StarterPlayerScripts)
-- A lightning display in the style crews use from real detection networks: range rings at 5, 10, and 15 miles
-- around the active site (the 10 mile stop work ring in red), compass points, a sweep, and every strike plotted by
-- bearing and distance, colored by age in simulated minutes and gone after the 30 minute window. Below it: the
-- nearest strike and how long ago, strikes in the last 10 minutes, the storm's trend (approaching or receding), and
-- the stop work countdown. Fed by ReplicatedStorage.StrikeRadar (bearing, miles) and the sim's SimTime.
local Players = game:GetService("Players")
local TextChatService = game:GetService("TextChatService")
local GuiService = game:GetService("GuiService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
local strikeRadar = ReplicatedStorage:WaitForChild("StrikeRadar")
local beacon = workspace:WaitForChild("Beacon")

local RANGE_MI, STOP_MI, WINDOW_S, RECENT_S = 15, 10, 30 * 60, 10 * 60
local THEME = {
	panel = Color3.fromRGB(14, 16, 22), scope = Color3.fromRGB(10, 22, 18), grid = Color3.fromRGB(70, 110, 95),
	text = Color3.fromRGB(236, 238, 243), dim = Color3.fromRGB(138, 145, 160), red = Color3.fromRGB(255, 80, 80),
	amber = Color3.fromRGB(255, 184, 28), green = Color3.fromRGB(80, 220, 130), fresh = Color3.fromRGB(255, 255, 255),
}

local gui = Instance.new("ScreenGui")
gui.Name, gui.ResetOnSpawn, gui.DisplayOrder = "LightningRadar", false, 14 -- under FlashGui so the white flash covers it
gui.IgnoreGuiInset = true -- screen pixels, the same space the chat window reports its position in
gui.Parent = player:WaitForChild("PlayerGui")
local uiScale = Instance.new("UIScale")
uiScale.Parent = gui
local function rescale()
	local ok, size = pcall(function() return workspace.CurrentCamera.ViewportSize end)
	uiScale.Scale = math.clamp((ok and size.Y or 900) / 900, 0.65, 1)
end
if workspace.CurrentCamera then workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(rescale) end
rescale()

local function round(inst, r)
	local c = Instance.new("UICorner")
	c.CornerRadius = r
	c.Parent = inst
end
local function label(parent, text, size, font, color, order)
	local t = Instance.new("TextLabel")
	t.LayoutOrder, t.BackgroundTransparency, t.Size = order or 0, 1, UDim2.new(1, 0, 0, 0)
	t.AutomaticSize = Enum.AutomaticSize.Y
	t.Font, t.TextSize, t.TextColor3 = font, size, color
	t.TextXAlignment, t.TextWrapped, t.Text = Enum.TextXAlignment.Left, true, text
	t.Parent = parent
	return t
end

local card = Instance.new("Frame")
card.AnchorPoint, card.Size = Vector2.new(1, 1), UDim2.fromOffset(360, 0) -- placeCard matches the zone card's width
card.Position = UDim2.new(1, -16, 1, -16)
card.AutomaticSize = Enum.AutomaticSize.Y
card.BackgroundColor3, card.BackgroundTransparency, card.BorderSizePixel = THEME.panel, 0.1, 0
card.Parent = gui
round(card, UDim.new(0, 12))
local pad = Instance.new("UIPadding")
pad.PaddingTop, pad.PaddingBottom, pad.PaddingLeft, pad.PaddingRight = UDim.new(0, 10), UDim.new(0, 10), UDim.new(0, 12), UDim.new(0, 12)
pad.Parent = card
local list = Instance.new("UIListLayout")
list.Padding, list.SortOrder = UDim.new(0, 6), Enum.SortOrder.LayoutOrder
list.Parent = card

label(card, "LIGHTNING DETECTION  ·  15 MI", 12, Enum.Font.GothamBold, THEME.amber, 1)

local scope = Instance.new("Frame")
scope.Name, scope.LayoutOrder, scope.Size = "Scope", 2, UDim2.fromOffset(220, 220)
scope.BackgroundColor3, scope.BorderSizePixel = THEME.scope, 0
scope.ClipsDescendants = true
scope.Parent = card
round(scope, UDim.new(1, 0))

local function ringLabel(text, mi)
	local t = Instance.new("TextLabel")
	t.AnchorPoint = Vector2.new(0, 1)
	t.Position = UDim2.fromScale(0.5 + 0.02, 0.5 - mi / RANGE_MI / 2 + 0.005)
	t.Size, t.BackgroundTransparency = UDim2.fromOffset(28, 12), 1
	t.Font, t.TextSize, t.TextColor3, t.Text = Enum.Font.GothamMedium, 10, mi == STOP_MI and THEME.red or THEME.grid, text
	t.TextXAlignment = Enum.TextXAlignment.Left
	t.ZIndex = 3
	t.Parent = scope
end
for _, mi in ipairs({ 5, 10, 15 }) do
	local ring = Instance.new("Frame")
	ring.AnchorPoint, ring.Position = Vector2.new(0.5, 0.5), UDim2.fromScale(0.5, 0.5)
	ring.Size = UDim2.fromScale(mi / RANGE_MI, mi / RANGE_MI)
	ring.BackgroundTransparency = 1
	ring.Parent = scope
	round(ring, UDim.new(1, 0))
	local s = Instance.new("UIStroke")
	s.Color = mi == STOP_MI and THEME.red or THEME.grid
	s.Transparency, s.Thickness = mi == STOP_MI and 0.05 or 0.35, mi == STOP_MI and 2 or 1
	s.Parent = ring
	if mi < RANGE_MI then ringLabel(mi .. " mi", mi) end
end
-- crosshair and compass points
for _, axis in ipairs({ { UDim2.new(1, 0, 0, 1) }, { UDim2.new(0, 1, 1, 0) } }) do
	local line = Instance.new("Frame")
	line.AnchorPoint, line.Position, line.Size = Vector2.new(0.5, 0.5), UDim2.fromScale(0.5, 0.5), axis[1]
	line.BackgroundColor3, line.BackgroundTransparency, line.BorderSizePixel = THEME.grid, 0.6, 0
	line.Parent = scope
end
for _, c in ipairs({ { "N", 0.5, 0.035 }, { "E", 0.965, 0.5 }, { "S", 0.5, 0.965 }, { "W", 0.035, 0.5 } }) do
	local t = Instance.new("TextLabel")
	t.AnchorPoint, t.Position, t.Size = Vector2.new(0.5, 0.5), UDim2.fromScale(c[2], c[3]), UDim2.fromOffset(14, 14)
	t.BackgroundTransparency, t.Font, t.TextSize, t.TextColor3, t.Text = 1, Enum.Font.GothamBold, 11, THEME.dim, c[1]
	t.ZIndex = 3
	t.Parent = scope
end
-- the sweep: a faint arm turning once every four seconds
local sweep = Instance.new("Frame")
sweep.AnchorPoint, sweep.Position, sweep.Size = Vector2.new(0.5, 1), UDim2.fromScale(0.5, 0.5), UDim2.new(0, 2, 0.5, 0)
sweep.BackgroundColor3, sweep.BackgroundTransparency, sweep.BorderSizePixel = THEME.green, 0.55, 0
sweep.Parent = scope
local sweepPivot = Instance.new("Frame") -- rotate a full size holder so the arm turns about the center
sweepPivot.AnchorPoint, sweepPivot.Position, sweepPivot.Size = Vector2.new(0.5, 0.5), UDim2.fromScale(0.5, 0.5), UDim2.fromScale(1, 1)
sweepPivot.BackgroundTransparency = 1
sweepPivot.Parent = scope
sweep.Parent = sweepPivot
local site = Instance.new("Frame")
site.AnchorPoint, site.Position, site.Size = Vector2.new(0.5, 0.5), UDim2.fromScale(0.5, 0.5), UDim2.fromOffset(9, 9)
site.BackgroundColor3, site.BorderSizePixel, site.ZIndex = THEME.green, 0, 4
site.Parent = scope
round(site, UDim.new(1, 0))

local nearestLine = label(card, "No strikes detected", 13, Enum.Font.GothamBold, THEME.green, 3)
local trendLine = label(card, "", 12, Enum.Font.GothamMedium, THEME.dim, 4)
local stopLine = label(card, "", 13, Enum.Font.GothamBold, THEME.red, 5)
stopLine.Name = "StopLine"
trendLine.Name = "TrendLine"
nearestLine.Name = "NearestLine"

-- simulated seconds when the sim is running, real seconds otherwise (free play strikes with no scenario)
local function now()
	return workspace:GetAttribute("SimTime") or os.clock()
end

local strikes = {}
strikeRadar.OnClientEvent:Connect(function(bearing, miles)
	local r = math.min(miles, RANGE_MI) / RANGE_MI / 2
	local dot = Instance.new("Frame")
	dot.Name = "Strike"
	dot.AnchorPoint = Vector2.new(0.5, 0.5)
	dot.Position = UDim2.fromScale(0.5 + math.sin(math.rad(bearing)) * r, 0.5 - math.cos(math.rad(bearing)) * r)
	dot.Size = UDim2.fromOffset(11, 11)
	dot.BackgroundColor3, dot.BorderSizePixel, dot.ZIndex = THEME.fresh, 0, 2
	dot.Parent = scope
	round(dot, UDim.new(1, 0))
	-- a cross inside the dot, the way detection maps mark a cloud to ground strike
	local cross = Instance.new("TextLabel")
	cross.BackgroundTransparency, cross.Size, cross.Text = 1, UDim2.fromScale(1, 1), "+"
	cross.Font, cross.TextScaled, cross.TextColor3, cross.ZIndex = Enum.Font.GothamBold, true, THEME.panel, 2
	cross.Parent = dot
	table.insert(strikes, { t = now(), miles = miles, bearing = bearing, dot = dot })
end)

-- a reset (new scenario or Reset to calm) clears the plot
workspace:GetAttributeChangedSignal("ResetSerial"):Connect(function()
	for _, s in ipairs(strikes) do s.dot:Destroy() end
	strikes = {}
end)

-- when a new scenario starts its clock restarts: clear the old strikes
workspace:GetAttributeChangedSignal("SimTime"):Connect(function()
	local t = workspace:GetAttribute("SimTime") or 0
	if #strikes > 0 and t < strikes[#strikes].t - 1 then
		for _, s in ipairs(strikes) do s.dot:Destroy() end
		strikes = {}
	end
end)

local COMPASS = { "N", "NE", "E", "SE", "S", "SW", "W", "NW" }
local function dir(b) return COMPASS[math.floor(((b % 360) + 22.5) / 45) % 8 + 1] end
local function mmss(s)
	s = math.max(0, math.floor(s))
	return ("%02d:%02d"):format(s // 60, s % 60)
end
local function ago(s)
	if s < 60 then return "just now" end
	return ("%d min ago"):format(math.floor(s / 60))
end

-- bottom right, sitting on top of the chat window with the same right edge. Reads where the chat actually is,
-- follows it if it resizes, and falls back to the corner when chat is off or not reporting.
local GAP = 10
local function chatBox()
	local ok, top, right = pcall(function()
		local window = TextChatService:FindFirstChildOfClass("ChatWindowConfiguration")
		local bar = TextChatService:FindFirstChildOfClass("ChatInputBarConfiguration")
		if not window or not window.Enabled or window.AbsoluteSize.Y <= 0 then return nil, nil end
		local t = window.AbsolutePosition.Y
		local r = window.AbsolutePosition.X + window.AbsoluteSize.X
		if bar and bar.Enabled and bar.AbsoluteSize.Y > 0 then
			t = math.min(t, bar.AbsolutePosition.Y)
			r = math.max(r, bar.AbsolutePosition.X + bar.AbsoluteSize.X)
		end
		return t, r
	end)
	if ok then return top, right end
	return nil, nil
end
local PAD_X = 24 -- the card's left and right padding, in this gui's units
local SCOPE_MIN = 140 -- the radar shrinks below its full width only when the chat cannot give any more room
local CHAT_MIN, CHAT_STEP = 0.5, 0.1 -- the chat gives up height first, down to half

-- the zone card (top right) in screen pixels: its right edge, width, and bottom edge
local function zoneCard()
	local ok, right, width, bottom = pcall(function()
		local hud = player.PlayerGui:FindFirstChild("ZoneHud")
		local zc = hud and hud:FindFirstChild("ZoneCard", true)
		if not zc or zc.AbsoluteSize.X <= 0 then return nil end
		local inset = GuiService:GetGuiInset() -- that card keeps the top bar inset, this gui does not
		return inset.X + zc.AbsolutePosition.X + zc.AbsoluteSize.X, zc.AbsoluteSize.X, inset.Y + zc.AbsolutePosition.Y + zc.AbsoluteSize.Y
	end)
	if ok and right then return right, width, bottom end
	return nil
end

local function chatWindow()
	return TextChatService:FindFirstChildOfClass("ChatWindowConfiguration")
end

local fitScope -- the scope size the fit settled on; nil means full width
local function placeCard()
	local s = uiScale.Scale
	local okView, view = pcall(function() return workspace.CurrentCamera.ViewportSize end)
	local zRight, zWidth, zBottom = zoneCard()

	-- same width as the zone card, right edges aligned
	local widthUnits = (zWidth or 360) / s
	local full = widthUnits - PAD_X
	local scopeSize = math.min(full, fitScope or full)
	card.Size = UDim2.fromOffset(widthUnits, 0)
	if math.abs(scope.Size.X.Offset - scopeSize) >= 1 then scope.Size = UDim2.fromOffset(scopeSize, scopeSize) end
	local right = zRight or (okView and view.X - 16)

	-- sit on top of the chat; trust its position only if it looks like a chat window in the lower part of the screen
	local top = chatBox()
	if top and okView and top < view.Y * 0.35 then top = nil end
	local bottomEdge = top and (top - GAP) or (okView and view.Y - 16) or nil
	if right and bottomEdge then
		-- positions inside a scaled ScreenGui are in scaled units: divide screen pixels by the scale
		card.Position = UDim2.fromOffset(right / s, bottomEdge / s)
	else
		card.Position = UDim2.new(1, -16, 1, -16)
	end

	-- too short for both: the chat gives up height first, the radar only once the chat is at its minimum
	if not (bottomEdge and card.AbsoluteSize.Y > 0) then return end
	local ceiling = (zBottom or 0) + GAP
	local spare = (bottomEdge - ceiling) - card.AbsoluteSize.Y -- screen pixels
	local window = chatWindow()
	local okChat, height = pcall(function() return window and window.HeightScale end)
	height = okChat and height or nil
	if spare < 0 then
		if height and height > CHAT_MIN + 0.001 then
			pcall(function() window.HeightScale = math.max(CHAT_MIN, height - CHAT_STEP) end)
		else
			fitScope = math.max(SCOPE_MIN, scope.Size.X.Offset + spare / s)
		end
	elseif fitScope and spare > 4 then
		fitScope = scope.Size.X.Offset + spare / s -- room again: the radar takes back its own size first
		if fitScope >= full then fitScope = nil end
	elseif height and height < 1 and spare > 60 then
		pcall(function() window.HeightScale = math.min(1, height + CHAT_STEP) end) -- then the chat grows back
	end
end
task.spawn(function()
	while true do
		placeCard()
		task.wait(0.5)
	end
end)

local spin = 0
RunService.RenderStepped:Connect(function(dt)
	spin = (spin + dt * 90) % 360
	sweepPivot.Rotation = spin
end)

while true do
	local t = now()
	-- age the dots: white when fresh, through amber to dim red, gone after 30 minutes
	local keep = {}
	for _, s in ipairs(strikes) do
		local age = t - s.t
		if age > WINDOW_S then
			s.dot:Destroy()
		else
			local k = math.clamp(age / WINDOW_S, 0, 1)
			s.dot.BackgroundColor3 = k < 0.15 and THEME.fresh or (k < 0.5 and THEME.amber or THEME.red)
			s.dot.BackgroundTransparency = k * 0.7
			table.insert(keep, s)
		end
	end
	strikes = keep

	local nearest, recent, older = nil, {}, {}
	for _, s in ipairs(strikes) do
		if not nearest or s.miles < nearest.miles then nearest = s end
		if t - s.t <= RECENT_S then table.insert(recent, s) elseif t - s.t <= 2 * RECENT_S then table.insert(older, s) end
	end
	if nearest then
		nearestLine.Text = ("Nearest %.1f mi %s  ·  %s"):format(nearest.miles, dir(nearest.bearing), ago(t - nearest.t))
		nearestLine.TextColor3 = nearest.miles < STOP_MI and THEME.red or THEME.amber
	else
		nearestLine.Text, nearestLine.TextColor3 = "No strikes in the last 30 min", THEME.green
	end
	local function avg(set)
		local sum = 0
		for _, s in ipairs(set) do sum += s.miles end
		return #set > 0 and sum / #set or nil
	end
	local a, b = avg(recent), avg(older)
	local trend = ""
	if a and b then
		local change = a - b
		trend = change < -0.5 and ("  ·  TREND APPROACHING %.1f mi/10 min"):format(-change)
			or change > 0.5 and ("  ·  TREND RECEDING %.1f mi/10 min"):format(change) or "  ·  TREND STEADY"
	end
	trendLine.Text = ("Last 10 min: %d strike%s%s"):format(#recent, #recent == 1 and "" or "s", trend)

	local real = beacon:GetAttribute("Countdown") or 0
	local left = real > 0 and real or (workspace:GetAttribute("SimCountdown") or 0)
	if left > 0 then
		stopLine.Text, stopLine.TextColor3 = "STOP WORK  ·  ALL CLEAR IN " .. mmss(left), THEME.red
	else
		stopLine.Text, stopLine.TextColor3 = "CLEAR  ·  no strike inside 10 mi for 30 min", THEME.green
	end
	task.wait(0.25)
end
