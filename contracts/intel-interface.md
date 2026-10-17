# core <-> intel

Tables core creates and intel writes:
- hazard_index (site_id, for_date, probability, index, top_features jsonb)
- briefings (site_id, for_date, generated, english, spanish, payload jsonb, source)
- reports.tag, reports.description, reports.confidence (columns on core's reports table)

Functions intel exposes (backend/app/intel/__init__.py):
- async def score_all() -> None                      scores every site for tomorrow, writes hazard_index, pushes INDEX to the beacon site
- async def run_briefing(site_id: int) -> dict        builds the payload from core's tables, calls Gemini with the number guard, writes briefings, returns {english, spanish, source}
- async def tag_photo(image_bytes: bytes, mime: str, site_name: str) -> dict   returns {tag, description, confidence}
- router: APIRouter with GET /sites/{id}/index/explain and POST /briefings/{site_id}/run

How core uses them:
- scheduler: intel.score_all() daily at 05:00 UTC; intel.run_briefing(site_id) at 18:00 local per site
- POST /reports handler calls intel.tag_photo before inserting
- main.py: app.include_router(intel.router)

What intel calls in core (imported inside the function, so intel still imports without core):
- app.core.db.get_pool()                     reads core's tables, writes the three above
- app.core.gateway.send(site_id, msg)        score_all sends {"cmd":"INDEX",...} to the beacon site
- app.core.scheduler.briefing_job(site_id)   POST /briefings/{site_id}/run calls it, so an on-demand briefing is pushed to the dashboard and spoken by the beacon exactly like the 6 PM one

Nothing else crosses the boundary.
