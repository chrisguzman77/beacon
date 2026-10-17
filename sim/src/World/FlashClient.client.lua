-- FlashClient (LocalScript in StarterPlayerScripts)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local SoundService = game:GetService("SoundService")

local SECONDS_PER_MILE = 4.69
local FLASH_FRAMES = 3

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

local function flash()
	frame.Visible = true
	for _ = 1, FLASH_FRAMES do
		RunService.RenderStepped:Wait()
	end
	frame.Visible = false
end

local function thunder(miles)
	local s = thunderTemplate:Clone()
	s.Volume = math.clamp(1.3 - miles * 0.04, 0.6, 1)
	-- far strikes sound lower and longer, the air soaks up the crack and leaves the rumble
	s.PlaybackSpeed = math.clamp(1.05 - miles * 0.02, 0.75, 1)
	s.Parent = SoundService
	s.Ended:Connect(function() s:Destroy() end)
	s:Play()
end

flashEvent.OnClientEvent:Connect(function(miles)
	task.spawn(flash)
	task.delay(miles * SECONDS_PER_MILE, thunder, miles)
	print(("[Flash] flash now, thunder in %.1f s"):format(miles * SECONDS_PER_MILE))
end)
