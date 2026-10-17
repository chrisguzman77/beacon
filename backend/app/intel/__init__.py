"""Intel, the boundary core calls (contracts/intel-interface.md).

run_briefing and tag_photo are real (block two). score_all and the explain route are still stubs returning
fixed plausible values until scoring.py lands; signatures do not change.
"""
from fastapi import APIRouter

from .briefing import run_briefing
from .gemini import tag_photo

STUB_INDEX = 5
STUB_FEATURES = [
    {'feature': 'heat_index', 'shap': 0.42, 'value': 104.0},
    {'feature': 'precip_3d', 'shap': 0.21, 'value': 38.0},
    {'feature': 'gust_max', 'shap': 0.09, 'value': 41.0},
]


async def score_all() -> None:
    """Stub: writes nothing. The real one scores every site for tomorrow, writes hazard_index, pushes INDEX."""
    return None


router = APIRouter()


@router.get('/sites/{site_id}/index/explain')
async def explain_index(site_id: int):
    return {'site_id': site_id, 'index': STUB_INDEX, 'top_features': STUB_FEATURES,
            'sentence': 'High heat and some recent rain put this site in the middle of the pack for tomorrow.'}


@router.post('/briefings/{site_id}/run')
async def run_briefing_now(site_id: int):
    return await run_briefing(site_id)
