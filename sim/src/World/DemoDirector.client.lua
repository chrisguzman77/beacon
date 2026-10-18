-- DemoDirector (LocalScript in StarterPlayerScripts)
-- Demo mode: while workspace.DemoMode is on, operators' cameras cut to each moment of the Everglades day and a
-- caption bar narrates it. Judges on their phones keep their own camera. The flash and thunder are untouched, the
-- director only moves the camera, so the real beacon still sees every strike.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local stateEvent = ReplicatedStorage:WaitForChild("ScenarioState")
local camera = workspace.CurrentCamera

-- simulated seconds after 06:45 -> shot and caption. Follows Scenarios.everglades_day.
local TIMELINE = {
	{ t = 0, shot = "Wide", text = "06:45, August, a remote Everglades jobsite. The crew is laying a temporary mat road for the equipment that will build a new transmission line." },
	{ t = 900, shot = "Road", text = "A week of rain: the soil is 82% saturated. Boots sink, trucks bog down. OmniRisk has already flagged it on the conditions board." },
	{ t = 2700, shot = "Gator", text = "07:30 a gator on the mat road. A crew member snaps a photo, it is tagged and pinned to the site map for every crew on the job." },
	{ t = 15300, shot = "Board", text = "11:00 the heat index climbs. The board combines heat, wind, rain, soil, lightning, flood, and wildlife into one picture." },
	{ t = 18900, shot = "Tent", text = "12:00 heat index past 110 F. The beacon sounds the heat alarm and the crew rotates through the cooling tent." },
	{ t = 24300, shot = "Storm", text = "13:30 thunderstorms building to the west. Watch the screen flash: the real beacon's light sensor is aimed at it." },
	{ t = 27900, shot = "Beacon", text = "14:30 strike 8 miles out. STOP WORK: the beacon strobes, the fan on the table stops, a 30 minute all clear starts." },
	{ t = 28800, shot = "Beacon", text = "14:45 a new strike at 6 miles restarts the 30 minute countdown. The crew stays in the trucks." },
	{ t = 29400, shot = "Flood", text = "14:55 the downpour. Water rises over the pad, the beacon switches to the flood alarm, the trucks sink to their axles." },
	{ t = 37800, shot = "Board", text = "17:15 the storm moves off. The all clear runs out 30 minutes after the last strike inside 10 miles." },
	{ t = 40500, shot = "Wide", text = "18:00 site time: the next-day safety briefing goes out in English and Spanish. Tomorrow's plan starts tonight." },
}
local CUT = TweenInfo.new(2.2, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut)

local gui = Instance.new("ScreenGui")
gui.Name, gui.ResetOnSpawn, gui.DisplayOrder = "DemoCaption", false, 20 -- under FlashGui so the white flash covers it
gui.Parent = player:WaitForChild("PlayerGui")
-- scale with the screen, same rule as the operator panel
local uiScale = Instance.new("UIScale")
uiScale.Parent = gui
local function rescale()
	local ok, size = pcall(function() return workspace.CurrentCamera.ViewportSize end)
	uiScale.Scale = math.clamp((ok and size.Y or 900) / 900, 0.65, 1)
end
if workspace.CurrentCamera then workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(rescale) end
rescale()
local bar = Instance.new("Frame")
bar.AnchorPoint, bar.Position, bar.Size = Vector2.new(0.5, 0), UDim2.new(0.5, 0, 0, 18), UDim2.new(0.7, 0, 0, 0)
bar.AutomaticSize = Enum.AutomaticSize.Y
bar.BackgroundColor3, bar.BackgroundTransparency, bar.BorderSizePixel = Color3.fromRGB(10, 12, 16), 0.2, 0
bar.Visible = false
bar.Parent = gui
local cap = Instance.new("UISizeConstraint") -- never wider than 640, so it clears the zone card top right
cap.MaxSize = Vector2.new(640, math.huge)
cap.Parent = bar
local corner = Instance.new("UICorner")
corner.CornerRadius = UDim.new(0, 12)
corner.Parent = bar
local pad = Instance.new("UIPadding")
pad.PaddingTop, pad.PaddingBottom, pad.PaddingLeft, pad.PaddingRight = UDim.new(0, 12), UDim.new(0, 12), UDim.new(0, 18), UDim.new(0, 18)
pad.Parent = bar
local layout = Instance.new("UIListLayout")
layout.Padding = UDim.new(0, 4)
layout.Parent = bar
local function line(name, font, size, color)
	local t = Instance.new("TextLabel")
	t.Name, t.BackgroundTransparency, t.Size = name, 1, UDim2.new(1, 0, 0, 0)
	t.AutomaticSize = Enum.AutomaticSize.Y
	t.Font, t.TextSize, t.TextColor3 = font, size, color
	t.TextWrapped, t.TextXAlignment = true, Enum.TextXAlignment.Left
	t.Text = ""
	t.Parent = bar
	return t
end
local header = line("Header", Enum.Font.GothamBold, 14, Color3.fromRGB(255, 184, 28))
local caption = line("Caption", Enum.Font.GothamMedium, 20, Color3.fromRGB(236, 238, 243))

local function isOperator() return player:GetAttribute("Operator") == true end

local currentStep, savedType = nil, nil
local function cutTo(shotName)
	if not camera or not isOperator() then return end
	local shots = workspace:FindFirstChild("Site") and workspace.Site:FindFirstChild("Shots")
	local shot = shots and shots:FindFirstChild(shotName)
	if not shot then return end
	if camera.CameraType ~= Enum.CameraType.Scriptable then
		savedType = camera.CameraType
		camera.CameraType = Enum.CameraType.Scriptable
	end
	TweenService:Create(camera, CUT, { CFrame = shot.CFrame }):Play()
end

local function stop()
	bar.Visible = false
	currentStep = nil
	if camera and savedType then
		camera.CameraType = savedType
		savedType = nil
	end
end

local function clockText(st)
	local h, m = st.clockStart:match("(%d+):(%d+)")
	local minutes = tonumber(h) * 60 + tonumber(m) + st.simTime / 60
	return ("%02d:%02d"):format(math.floor(minutes / 60) % 24, math.floor(minutes % 60))
end

stateEvent.OnClientEvent:Connect(function(st)
	if not workspace:GetAttribute("DemoMode") or st.key ~= "everglades_day" then
		if currentStep then stop() end
		return
	end
	local step = 1
	for i, s in ipairs(TIMELINE) do
		if st.simTime >= s.t then step = i end
	end
	bar.Visible = true
	header.Text = ("OMNIRISK DEMO  ·  %s  ·  %s"):format(clockText(st), st.name:upper())
	if step ~= currentStep then
		currentStep = step
		caption.Text = TIMELINE[step].text
		cutTo(TIMELINE[step].shot)
	end
end)

workspace:GetAttributeChangedSignal("DemoMode"):Connect(function()
	if not workspace:GetAttribute("DemoMode") then stop() end
end)
