-- Http (ModuleScript in ServerScriptService/Bridge)
local HttpService = game:GetService("HttpService")

local Http = {}
Http.online = false
Http.OnlineChanged = Instance.new("BindableEvent")

local cfg = nil

function Http.configure(source)
	cfg = {
		url = tostring(source:GetAttribute("BACKEND_URL") or ""):gsub("/$", ""),
		token = tostring(source:GetAttribute("SIM_TOKEN") or ""),
		site = tonumber(source:GetAttribute("SITE_ID")) or 1,
	}
	assert(cfg.url ~= "", "Bridge script needs a BACKEND_URL attribute")
	assert(cfg.token ~= "", "Bridge script needs a SIM_TOKEN attribute")
end

function Http.siteId() return cfg.site end

local function setOnline(v)
	if v ~= Http.online then
		Http.online = v
		Http.OnlineChanged:Fire(v)
		print("[Http] online =", v)
	end
end

local function request(method, path, body)
	local req = {
		Url = cfg.url .. path,
		Method = method,
		Headers = { ["X-Token"] = cfg.token, ["Content-Type"] = "application/json" },
	}
	if body then req.Body = HttpService:JSONEncode(body) end
	for attempt = 1, 2 do
		local ok, res = pcall(HttpService.RequestAsync, HttpService, req)
		if ok and res.Success then
			setOnline(true)
			if res.Body and #res.Body > 0 then
				local decoded, data = pcall(HttpService.JSONDecode, HttpService, res.Body)
				return decoded and data or {}
			end
			return {}
		end
		if ok then
			warn(("[Http] %s %s -> %d %s"):format(method, path, res.StatusCode, res.StatusMessage))
		else
			warn(("[Http] %s %s failed: %s"):format(method, path, tostring(res)))
		end
		if attempt == 1 then task.wait(0.5) end
	end
	setOnline(false)
	return nil
end

function Http.post(path, body)
	body.site_id = cfg.site
	return request("POST", path, body)
end

function Http.get(path)
	return request("GET", path)
end

return Http
