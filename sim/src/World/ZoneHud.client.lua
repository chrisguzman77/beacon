-- ZoneHud (LocalScript in StarterPlayerScripts)
-- A small card for everyone in the experience, judges on phones included: are you inside the work zone (and so on
-- the muster list), and what the beacon is saying right now. During a stop work it tells people in the zone to leave.
-- It reads only what is already replicated: the ZonePart, the Beacon's level tag, and the sim's stop work flag.
local Players = game:GetService("Players")

local player = Players.LocalPlayer

-- Start each spawn in first person, free to scroll out: clamp the zoom to first person for a moment, then give the
-- normal range back. Not locked. Skipped while the guided demo is cutting the camera.
local NORMAL_MAX_ZOOM = 40
local function firstPerson()
	if workspace:GetAttribute("DemoMode") == true then return end
	player.CameraMaxZoomDistance = 0.5
	task.wait()
	task.wait()
	player.CameraMaxZoomDistance = NORMAL_MAX_ZOOM
end
player.CharacterAdded:Connect(function() task.defer(firstPerson) end)
if player.Character then task.defer(firstPerson) end
local zone = workspace:WaitForChild("ZonePart")
local beacon = workspace:WaitForChild("Beacon")

local GREEN, AMBER, RED, TEXT = Color3.fromRGB(80, 220, 130), Color3.fromRGB(255, 184, 28), Color3.fromRGB(255, 80, 80), Color3.fromRGB(236, 238, 243)

local gui = Instance.new("ScreenGui")
gui.Name, gui.ResetOnSpawn, gui.DisplayOrder = "ZoneHud", false, 15 -- under FlashGui so the white flash covers it
gui.Parent = player:WaitForChild("PlayerGui")
-- scale with the screen, same rule as the operator panel
local uiScale = Instance.new("UIScale")
uiScale.Parent = gui
local function rescale()
	local ok, size = pcall(function() return workspace.CurrentCamera.ViewportSize end)
	-- 20% larger than the other screens: judges read this card from their phones
	uiScale.Scale = math.clamp((ok and size.Y or 900) / 900, 0.65, 1) * 1.2
end
if workspace.CurrentCamera then workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(rescale) end
rescale()
local card = Instance.new("Frame")
-- top right, just below Roblox's top bar (this ScreenGui keeps the top bar inset); the radar fits itself below it
card.Name = "ZoneCard"
card.AnchorPoint, card.Position, card.Size = Vector2.new(1, 0), UDim2.new(1, -16, 0, 12), UDim2.fromOffset(300, 0)
card.AutomaticSize = Enum.AutomaticSize.Y
card.BackgroundColor3, card.BackgroundTransparency, card.BorderSizePixel = Color3.fromRGB(14, 16, 22), 0.15, 0
card.Parent = gui
local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 12)
corner.Parent = card
local stroke = Instance.new("UIStroke")
stroke.Thickness, stroke.Color = 2, GREEN
stroke.Parent = card
local pad = Instance.new("UIPadding")
pad.PaddingTop, pad.PaddingBottom, pad.PaddingLeft, pad.PaddingRight = UDim.new(0, 10), UDim.new(0, 10), UDim.new(0, 14), UDim.new(0, 14)
pad.Parent = card
local list = Instance.new("UIListLayout")
list.Padding = UDim.new(0, 3)
list.SortOrder = Enum.SortOrder.LayoutOrder
list.Parent = card
local function line(name, order, font, size, color)
	local t = Instance.new("TextLabel")
	t.Name, t.LayoutOrder, t.BackgroundTransparency = name, order, 1
	t.Size, t.AutomaticSize = UDim2.new(1, 0, 0, 0), Enum.AutomaticSize.Y
	t.Font, t.TextSize, t.TextColor3 = font, size, color
	t.TextWrapped, t.TextXAlignment = true, Enum.TextXAlignment.Left
	t.Text = ""
	t.Parent = card
	return t
end
local callLine = line("Call", 0, Enum.Font.GothamBold, 13, TEXT)
local beaconLine = line("Beacon", 1, Enum.Font.GothamBold, 15, GREEN)
local zoneLine = line("Zone", 2, Enum.Font.GothamBold, 17, TEXT)
local hintLine = line("Hint", 3, Enum.Font.Gotham, 13, Color3.fromRGB(170, 176, 190))

local function inZone()
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if not root then return false end
	local p = zone.CFrame:PointToObjectSpace(root.Position)
	local half = zone.Size / 2
	return math.abs(p.X) <= half.X and math.abs(p.Y) <= half.Y and math.abs(p.Z) <= half.Z
end

local function render()
	local tag = beacon:FindFirstChild("Light") and beacon.Light:FindFirstChild("LevelTag")
	local level = tag and tag:FindFirstChild("Level")
	local state = level and level.Text or "ALL CLEAR"
	local color = level and level.TextColor3 or GREEN
	local stop = state:find("STOP WORK") ~= nil or workspace:GetAttribute("SimStopWork") == true
	local go = workspace:GetAttribute("GoNoGo") or "GO"
	callLine.Text = "SITE CALL  ·  " .. (workspace:GetAttribute("Tailboard") and "TAILBOARD, THEN " or "") .. go
	callLine.TextColor3 = go == "NO-GO" and RED or go == "GO" and GREEN or AMBER
	beaconLine.Text = "BEACON  ·  " .. state
	beaconLine.TextColor3 = color
	local inside = inZone()
	if inside and stop then
		zoneLine.Text, zoneLine.TextColor3 = "STOP WORK, LEAVE THE WORK ZONE", RED
		hintLine.Text = "Lightning inside 10 miles. Get to a truck until the 30 minute all clear."
		stroke.Color = RED
	elseif inside then
		zoneLine.Text, zoneLine.TextColor3 = "IN THE WORK ZONE  ·  on the muster list", GREEN
		hintLine.Text = "The real beacon on the table counts you as crew on site. Step out to check out."
		stroke.Color = GREEN
	else
		zoneLine.Text, zoneLine.TextColor3 = "OUTSIDE THE WORK ZONE", AMBER
		hintLine.Text = "Walk into the striped work zone by the beacon to check in on the muster list."
		stroke.Color = stop and RED or AMBER
	end
end

while true do
	render()
	task.wait(0.25)
end
