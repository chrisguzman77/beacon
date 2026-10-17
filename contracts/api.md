# HTTP and websocket API

Auth: Bearer Auth0 JWT for humans (role claim https://planit-beacon/role = supervisor | crew). Static tokens for machines: X-Token: GATEWAY_TOKEN or SIM_TOKEN.

GET  /health                                   any         fetcher health, last success per feed
GET  /sites                                    any         all sites with index, alert summary, last conditions, crew_on_site
GET  /sites/{id}                               any         detail: conditions 48h, alerts, reports, briefing, index with top_features
GET  /sites/{id}/conditions?hours=48           any         from site_hourly, both sources
GET  /sites/{id}/index/explain                 any         latest index: {site_id, for_date, index, probability, top_features: [{feature, shap, value, label}], sentence, source}  (intel router)
GET  /sites/{id}/device                        any         last device state from the gateway (for Roblox polling and the dashboard)
GET  /sites/{id}/muster                        any         crew in, out, zone_clear
POST /checkin                                  crew/sup    {site_id, action, lat, lon, via}
POST /reports                                  crew/sup    multipart: photo, site_id, lat, lon, note  -> {report_id, tag, description, confidence}
POST /alerts/{id}/clear                        supervisor  {pin}
POST /briefings/{site_id}/run                  supervisor  generate now
POST /sim/strike                               SIM_TOKEN   {site_id, bearing, miles} or {site_id, lat, lon}
POST /sim/weather                              SIM_TOKEN   {site_id, temp_c, humidity, precip_mm, gust}
POST /sim/water                                SIM_TOKEN   {site_id, depth_mm}
POST /sim/presence                             SIM_TOKEN   {site_id, count, users: ["name"]}
POST /sim/bang                                 SIM_TOKEN   {site_id, ts_us}      from the mic listener page
GET  /sim/scenario/{site_id}                   SIM_TOKEN   optional: the backend can hold the "current scenario" so the dashboard shows what Roblox is playing
WS   /ws/site/{id}?token=                      any         pushes alerts, conditions, muster, reports, count, device state
WS   /ws/gateway/{site_id}?token=              gateway     see gateway-ws.md
