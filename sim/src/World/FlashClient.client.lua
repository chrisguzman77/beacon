-- FlashClient (LocalScript in StarterPlayerScripts)
-- Light and sound of a strike, in real seconds. The flash is instant; the thunder arrives after the distance over
-- the speed of sound at the scenario's air temperature. Same formulas as StormModel (a server module the client
-- cannot require), so keep the two in step.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local SoundService = game:GetService("SoundService")

local METERS_PER_MILE = 1609.344
local FLASH_FRAMES = 3
-- Sound.Volume at 1 mi and closer. Thunder falls off as 1/d from there, so a strike at 8 mi plays at 1/8 of this;
-- 3 keeps it loud enough for the laptop speakers to reach the mic listener at demo distances.
local FULL_VOLUME = 3

local player = Players.LocalPlayer
local flashEvent = ReplicatedStorage:WaitForChild("FlashEvent")
local thunderTemplate = ReplicatedStorage:WaitForChild("Thunder")

local gui = Instance.new("ScreenGui")
gui.Name = "FlashGui"
gui.IgnoreGuiInset = true
gui.DisplayOrder = 1000
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

local frame = Instance.new("Frame")
frame.Size = UDim2.fromScale(1, 1)
frame.BackgroundColor3 = Color3.new(1, 1, 1)
frame.BorderSizePixel = 0
frame.ZIndex = 1000
frame.Visible = false
frame.Parent = gui

-- speed of sound in air, m/s, at T degrees C
local function soundSpeed(tempC) return 331.3 + 0.606 * tempC end
-- flash brightness 1/d^2, full at 3 mi or closer, floor 0.15 so it shows at any distance
local function brightness(miles) return math.max(0.15, math.min(1, 9 / (miles * miles))) end
-- thunder amplitude 1/d, full at 1 mi or closer, fading to silent between 10 and 15 mi
local function gain(miles)
	if miles >= 15 then return 0 end
	local g = math.min(1, 1 / miles)
	if miles > 10 then g *= (15 - miles) / 5 end
	return g
end

local function flash(miles)
	frame.BackgroundTransparency = 1 - brightness(miles)
	frame.Visible = true
	for _ = 1, FLASH_FRAMES do
		RunService.RenderStepped:Wait()
	end
	frame.Visible = false
end

local function play(speed, volume)
	local s = thunderTemplate:Clone()
	s.Volume, s.PlaybackSpeed = volume, speed
	s.Parent = SoundService
	s.Ended:Connect(function() s:Destroy() end)
	s:Play()
end

local function thunder(miles, volume)
	-- far strikes sound lower: the air soaks up the crack and leaves the rumble
	local speed = math.clamp(1.05 - miles * 0.02, 0.75, 1)
	play(speed, volume)
	-- and rumble longer: the sound comes in over a longer path spread, so far thunder gets slower, quieter echoes
	-- trailing the first roll (none for a close crack, two past 6 mi)
	local echoes = miles > 6 and 2 or miles > 3 and 1 or 0
	for i = 1, echoes do
		task.delay(0.35 * i * (miles / 5), play, speed * (1 - 0.06 * i), volume * 0.6 ^ i)
	end
end

flashEvent.OnClientEvent:Connect(function(miles)
	task.spawn(flash, miles)
	local delay = miles * METERS_PER_MILE / soundSpeed(workspace:GetAttribute("AirTempC") or 25)
	local volume = FULL_VOLUME * gain(miles)
	-- for the harness and for checking a demo laptop: what this client scheduled for the last strike
	player:SetAttribute("LastThunderDelay", delay)
	player:SetAttribute("LastThunderVolume", volume)
	player:SetAttribute("LastFlashBrightness", brightness(miles))
	if volume > 0 then task.delay(delay, thunder, miles, volume) end
	print(("[Flash] flash now at %.2f mi, thunder in %.1f s%s"):format(miles, delay, volume > 0 and "" or " (too far to hear)"))
end)
