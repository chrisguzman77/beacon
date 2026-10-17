"""Intel, the boundary core calls (contracts/intel-interface.md).

Block one stubs: fixed plausible values so core runs end to end. Replaced by scoring.py, briefing.py,
gemini.py, and router.py in later blocks without changing these signatures.
"""
from fastapi import APIRouter

STUB_INDEX = 5
STUB_FEATURES = [
    {'feature': 'heat_index', 'shap': 0.42, 'value': 104.0},
    {'feature': 'precip_3d', 'shap': 0.21, 'value': 38.0},
    {'feature': 'gust_max', 'shap': 0.09, 'value': 41.0},
]


async def score_all() -> None:
    """Stub: writes nothing. The real one scores every site for tomorrow, writes hazard_index, pushes INDEX."""
    return None


async def run_briefing(site_id: int) -> dict:
    """Stub: fixed briefing. The real one builds the payload, calls Gemini with the number guard, writes briefings."""
    return {
        'english': 'Tomorrow the biggest risk is heat. Heat index reaches 104 F by early afternoon. '
                   'Take a shaded water break every hour and watch each other for heat illness. '
                   'Scattered storms are possible after 3 PM. If you hear thunder, stop work and get to the trucks.',
        'spanish': 'Mañana el mayor riesgo es el calor. El índice de calor llega a 104 F a primera hora de la tarde. '
                   'Tomen un descanso con agua a la sombra cada hora y vigílense entre ustedes. '
                   'Puede haber tormentas dispersas después de las 3 PM. Si oyen truenos, paren el trabajo y vayan a los camiones.',
        'source': 'stub',
    }


async def tag_photo(image_bytes: bytes, mime: str, site_name: str) -> dict:
    """Stub: fixed tag. The real one classifies the photo with Gemini."""
    return {'tag': 'standing_water', 'description': f'Standing water near the work area at {site_name}, check footing before entering.',
            'confidence': 0.72}


router = APIRouter()


@router.get('/sites/{site_id}/index/explain')
async def explain_index(site_id: int):
    return {'site_id': site_id, 'index': STUB_INDEX, 'top_features': STUB_FEATURES,
            'sentence': 'High heat and some recent rain put this site in the middle of the pack for tomorrow.'}


@router.post('/briefings/{site_id}/run')
async def run_briefing_now(site_id: int):
    return await run_briefing(site_id)
