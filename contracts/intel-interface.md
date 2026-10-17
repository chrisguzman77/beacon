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

Nothing else crosses the boundary. If intel needs data, it reads core's tables directly through the shared asyncpg pool (backend/app/core/db.py exposes get_pool()).
