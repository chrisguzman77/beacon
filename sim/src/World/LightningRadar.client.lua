-- LightningRadar (LocalScript in StarterPlayerScripts)
-- A live lightning radar for everyone: range rings at 5, 10, and 15 miles around the active site, the 10 mile
-- stop work ring in red, each strike plotted by bearing and distance and fading over a minute, and a status line
-- with the stop work countdown. Fed by ReplicatedStorage.StrikeRadar, which Lightning fires with (bearing, miles).
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local strikeRadar = ReplicatedStorage:WaitForChild("StrikeRadar")
local beacon = workspace:WaitForChild("Beacon")

local RANGE_MI, STOP_MI, KEEP, FADE_S = 15, 10, 14, 60
local THEME = {
	panel = Color3.fromRGB(14, 16, 22), raised = Color3.fromRGB(30, 34, 44), text = Color3.fromRGB(236, 238, 243),
	dim = Color3.fromRGB(138, 145, 160), red = Color3.fromRGB(255, 80, 80), amber = Color3.fromRGB(255, 184, 28),
	green = Color3.fromRGB(80, 220, 130),
}

local gui = Instance.new("ScreenGui")
gui.Name, gui.ResetOnSpawn, gui.DisplayOrder = "LightningRadar", false, 14 -- under FlashGui so the white flash covers it
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

local card = Instance.new("Frame")
card.Position, card.Size = UDim2.fromOffset(16, 64), UDim2.fromOffset(212, 0)
card.AutomaticSize = Enum.AutomaticSize.Y
card.BackgroundColor3, card.BackgroundTransparency, card.BorderSizePixel = THEME.panel, 0.12, 0
card.Parent = gui
round(card, UDim.new(0, 12))
local pad = Instance.new("UIPadding")
pad.PaddingTop, pad.PaddingBottom, pad.PaddingLeft, pad.PaddingRight = UDim.new(0, 10), UDim.new(0, 10), UDim.new(0, 11), UDim.new(0, 11)
pad.Parent = card
local list = Instance.new("UIListLayout")
list.Padding, list.SortOrder = UDim.new(0, 6), Enum.SortOrder.LayoutOrder
list.Parent = card

local title = Instance.new("TextLabel")
title.LayoutOrder, title.BackgroundTransparency, title.Size = 1, 1, UDim2.new(1, 0, 0, 14)
title.Font, title.TextSize, title.TextColor3 = Enum.Font.GothamBold, 12, THEME.amber
title.TextXAlignment, title.Text = Enum.TextXAlignment.Left, "LIGHTNING RADAR  ·  15 MI"
title.Parent = card

local scope = Instance.new("Frame")
scope.Name, scope.LayoutOrder, scope.Size = "Scope", 2, UDim2.fromOffset(190, 190)
scope.BackgroundColor3, scope.BorderSizePixel = THEME.raised, 0
scope.ClipsDescendants = true
scope.Parent = card
round(scope, UDim.new(1, 0))
for _, mi in ipairs({ 5, 10, 15 }) do
	local ring = Instance.new("Frame")
	ring.AnchorPoint, ring.Position = Vector2.new(0.5, 0.5), UDim2.fromScale(0.5, 0.5)
	ring.Size = UDim2.fromScale(mi / RANGE_MI, mi / RANGE_MI)
	ring.BackgroundTransparency = 1
	ring.Parent = scope
	round(ring, UDim.new(1, 0))
	local s = Instance.new("UIStroke")
	s.Color = mi == STOP_MI and THEME.red or THEME.dim
	s.Transparency, s.Thickness = mi == STOP_MI and 0.1 or 0.6, mi == STOP_MI and 2 or 1
	s.Parent = ring
end
local north = Instance.new("TextLabel")
north.AnchorPoint, north.Position, north.Size = Vector2.new(0.5, 0), UDim2.new(0.5, 0, 0, 2), UDim2.fromOffset(16, 14)
north.BackgroundTransparency, north.Font, north.TextSize, north.TextColor3, north.Text = 1, Enum.Font.GothamBold, 11, THEME.dim, "N"
north.Parent = scope
local site = Instance.new("Frame")
site.AnchorPoint, site.Position, site.Size = Vector2.new(0.5, 0.5), UDim2.fromScale(0.5, 0.5), UDim2.fromOffset(8, 8)
site.BackgroundColor3, site.BorderSizePixel, site.ZIndex = THEME.green, 0, 3
site.Parent = scope
round(site, UDim.new(1, 0))

local status = Instance.new("TextLabel")
status.LayoutOrder, status.BackgroundTransparency, status.Size = 3, 1, UDim2.new(1, 0, 0, 0)
status.AutomaticSize = Enum.AutomaticSize.Y
status.Font, status.TextSize, status.TextColor3 = Enum.Font.GothamMedium, 13, THEME.green
status.TextXAlignment, status.TextWrapped, status.Text = Enum.TextXAlignment.Left, true, "No strikes detected"
status.Parent = card

local dots, nearest = {}, nil
strikeRadar.OnClientEvent:Connect(function(bearing, miles)
	local r = math.min(miles, RANGE_MI) / RANGE_MI / 2
	local dot = Instance.new("Frame")
	dot.Name = "Strike"
	dot.AnchorPoint = Vector2.new(0.5, 0.5)
	dot.Position = UDim2.fromScale(0.5 + math.sin(math.rad(bearing)) * r, 0.5 - math.cos(math.rad(bearing)) * r)
	dot.Size = UDim2.fromOffset(10, 10)
	dot.BackgroundColor3 = miles < STOP_MI and THEME.red or THEME.amber
	dot.BorderSizePixel, dot.ZIndex = 0, 2
	dot.Parent = scope
	round(dot, UDim.new(1, 0))
	TweenService:Create(dot, TweenInfo.new(FADE_S, Enum.EasingStyle.Linear), { BackgroundTransparency = 1, Size = UDim2.fromOffset(5, 5) }):Play()
	table.insert(dots, dot)
	if #dots > KEEP then table.remove(dots, 1):Destroy() end
	nearest = { miles = miles, bearing = bearing, at = os.clock() }
end)

local COMPASS = { "N", "NE", "E", "SE", "S", "SW", "W", "NW" }
local function mmss(s)
	s = math.max(0, math.floor(s))
	return ("%02d:%02d"):format(s // 60, s % 60)
end
while true do
	local real = beacon:GetAttribute("Countdown") or 0
	local left = real > 0 and real or (workspace:GetAttribute("SimCountdown") or 0)
	local last = nearest and ("Last strike %.0f mi %s"):format(nearest.miles, COMPASS[math.floor(((nearest.bearing % 360) + 22.5) / 45) % 8 + 1]) or nil
	if left > 0 then
		status.Text = ("STOP WORK  %s%s"):format(mmss(left), last and ("\n" .. last) or "")
		status.TextColor3 = THEME.red
	elseif last then
		status.Text = "Clear inside 10 mi\n" .. last
		status.TextColor3 = (nearest.miles < STOP_MI and THEME.green) or THEME.amber
	else
		status.Text, status.TextColor3 = "No strikes detected", THEME.green
	end
	task.wait(0.25)
end
