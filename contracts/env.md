# Environment variables

Copy .env.example to .env where needed. Who sets what:

Backend (.env in repo root, read by docker compose and by uvicorn)
  DATABASE_URL            Viet (from Tiger Cloud)
  AUTH0_DOMAIN, AUTH0_AUDIENCE, AUTH0_CLIENT_ID   Viet (from the Auth0 tenant)
  GEMINI_API_KEY, GEMINI_MODEL                    Chris
  GATEWAY_TOKEN, SIM_TOKEN                        Chris (generate with openssl rand -hex 24), shared with Slavik
  UPLOAD_DIR, PUBLIC_URL, BEACON_SITE_ID, DEMO_COUNTDOWN_SCALE   Chris
  SUPERVISOR_PIN          Chris (the four digit release PIN, default 1234; the Pi's SUPERVISOR_PIN must match)

Web (web/.env)
  VITE_API_URL, VITE_AUTH0_*, VITE_MAPTILER_KEY     Cam (MapTiler key from Cam's account or Chris's)

Gateway (firmware/gateway/.env on the Pi)
  BACKEND_URL, GATEWAY_TOKEN, SITE_ID, POD_PORT, UNO_PORT, SUPERVISOR_PIN, DEMO_COUNTDOWN_SCALE   Slavik

Roblox (attributes on the Bridge script in Studio)
  BACKEND_URL, SIM_TOKEN, SITE_ID   Slavik
