-- Zone (Script in ServerScriptService/World)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local zone = workspace:WaitForChild("ZonePart")
local events = ReplicatedStorage:WaitForChild("SimEvents")

local params = OverlapParams.new()
params.FilterType = Enum.RaycastFilterType.Exclude
params.FilterDescendantsInstances = { zone }

local function playerOf(part)
	local node = part
	while node and node ~= workspace do
		if node:IsA("Model") and node:FindFirstChildOfClass("Humanoid") then
			return Players:GetPlayerFromCharacter(node)
		end
		node = node.Parent
	end
	return nil
end

local last = ""
while true do
	local set = {}
	for _, part in ipairs(workspace:GetPartBoundsInBox(zone.CFrame, zone.Size, params)) do
		local plr = playerOf(part)
		if plr then set[plr.Name] = true end
	end
	local users = {}
	for name in pairs(set) do table.insert(users, name) end
	table.sort(users)
	local key = table.concat(users, ",")
	if key ~= last then
		last = key
		events.PresenceChanged:Fire(#users, users)
		print(("[Zone] %d in zone (%s)"):format(#users, key))
	end
	task.wait(0.5)
end
