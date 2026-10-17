-- FakeBridge (Script in ServerScriptService/Bridge)
local beacon = workspace:WaitForChild("Beacon")
local function set(t) for k, v in pairs(t) do beacon:SetAttribute(k, v) end end

while true do
	set({ Led = "green", Countdown = 0, Index = 3, Interlock = "running", Presence = false, Online = true,
		Lcd1 = "RIG 1  RUNNING", Lcd2 = "BEACON LINK OK", Alerts = "[]" })
	task.wait(8)
	set({ Led = "strobe", Interlock = "locked", Index = 8, Presence = true, Lcd1 = "LOCKED OUT", Alerts = '["stopwork"]' })
	for s = 30, 0, -1 do
		set({ Countdown = s, Lcd2 = ("LIGHTNING 8MI %02d:%02d"):format(s // 60, s % 60) })
		task.wait(1)
	end
	set({ Led = "red", Presence = false, Lcd2 = "NEEDS SUPERVISOR" })
	task.wait(5)
	set({ Led = "green", Interlock = "running", Index = 3, Lcd1 = "RELEASED BY SMITH", Lcd2 = "14:02 SAT OCT 18", Alerts = "[]" })
	task.wait(4)
end
