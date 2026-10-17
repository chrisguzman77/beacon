"""Intel, the boundary core calls (contracts/intel-interface.md).

Everything here is real: score_all (scoring.py), run_briefing (briefing.py), tag_photo and the explanation (gemini.py).
"""
from fastapi import APIRouter, HTTPException

from . import gemini
from .briefing import run_briefing
from .gemini import tag_photo
from .scoring import score_all

router = APIRouter()


_explained: dict[tuple, tuple[str, str]] = {}   # (site_id, for_date, index) -> (sentence, source), one Gemini call per score


@router.get('/sites/{site_id}/index/explain')
async def explain_index(site_id: int):
    from app.core.db import get_pool   # core lands separately; import here so intel imports without it
    r = await get_pool().fetchrow(
        'SELECT h.for_date, h.probability, h.index, h.top_features, s.name FROM hazard_index h JOIN sites s USING (site_id) '
        'WHERE site_id = $1 ORDER BY for_date DESC LIMIT 1', site_id)
    if not r:
        raise HTTPException(404, 'no hazard index for this site yet')
    key = (site_id, r['for_date'], r['index'])
    sentence, source = _explained.get(key) or await gemini.explain(r['name'], r['index'], r['top_features'])
    if source == 'gemini':   # a template fallback is not cached, so the next click tries Gemini again
        _explained[key] = (sentence, source)
    return {'site_id': site_id, 'for_date': r['for_date'].isoformat(), 'index': r['index'], 'probability': r['probability'],
            'top_features': r['top_features'], 'sentence': sentence, 'source': source}


@router.post('/briefings/{site_id}/run')
async def run_briefing_now(site_id: int):
    # Through core's 6 PM job (contracts/intel-interface.md), so it reaches the dashboard and the beacon too.
    from app.core.scheduler import briefing_job
    result = await briefing_job(site_id)
    if result is None:
        raise HTTPException(502, 'briefing failed, see the backend log')
    return result
