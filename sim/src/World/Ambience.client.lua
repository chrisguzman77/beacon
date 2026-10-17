-- Ambience (LocalScript in StarterPlayerScripts)
-- Swamp sound: frogs and insects when it is calm, rain on the water when a scenario brings rain.
-- Both are Roblox licensed library audio (ProSoundEffects), nothing uploaded. Volumes change over 6 s,
-- never in a jump, so the mic listener's thunder detector (a 4x rise in under 0.3 s) cannot mistake them for thunder.
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")

local FROGS_ID = "rbxassetid://9112809746" -- Jungle Frogs 1, 46 s loop
local RAIN_ID = "rbxassetid://9112854469" -- Rain On Water 1, 61 s loop
local FROGS_MAX, RAIN_MAX = 0.25, 0.45
local FADE = TweenInfo.new(6, Enum.EasingStyle.Sine)

local function loop(name, id)
	local s = Instance.new("Sound")
	s.Name, s.SoundId, s.Looped, s.Volume = name, id, true, 0
	s.Parent = SoundService
	s:Play()
	return s
end
local frogs = loop("SwampFrogs", FROGS_ID)
local rain = loop("SwampRain", RAIN_ID)

local function update()
	local storm = workspace:GetAttribute("Storm") or 0
	local mm = workspace:GetAttribute("Rain") or 0
	TweenService:Create(frogs, FADE, { Volume = FROGS_MAX * (1 - storm) }):Play() -- the frogs go quiet as the storm builds
	TweenService:Create(rain, FADE, { Volume = RAIN_MAX * math.clamp(mm / 40, 0, 1) }):Play()
end
workspace:GetAttributeChangedSignal("Storm"):Connect(update)
workspace:GetAttributeChangedSignal("Rain"):Connect(update)
update()
