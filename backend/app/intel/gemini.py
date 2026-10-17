"""Gemini calls for intel (ai-ml-guide section 7). Every call uses a JSON response schema; text goes through the number guard."""
import json, logging, re
from pathlib import Path

from google import genai
from google.genai import types
from pydantic_settings import BaseSettings, SettingsConfigDict

log = logging.getLogger('intel.gemini')


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(str(Path(__file__).resolve().parents[3] / '.env'), '.env'), extra='ignore')
    gemini_api_key: str = ''
    gemini_model: str = 'gemini-3.8-flash'


settings = Settings()
_client = None


def client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


async def generate(contents, schema: dict) -> dict:
    r = await client().aio.models.generate_content(
        model=settings.gemini_model, contents=contents,
        config=types.GenerateContentConfig(response_mime_type='application/json', response_schema=schema))
    return json.loads(r.text)


# --- number guard ---------------------------------------------------------------

def numbers(s: str) -> set[float]:
    return {float(n) for n in re.findall(r'\d+(?:\.\d+)?', s)}


def invented(text: str, payload: dict) -> set[float]:
    """Numbers in text that do not appear anywhere in the payload."""
    return numbers(text) - numbers(json.dumps(payload, ensure_ascii=False))


# --- 7.2 hazard photo tagging ---------------------------------------------------

TAGS = ['alligator', 'snake', 'standing_water', 'downed_line', 'unstable_ground', 'equipment', 'heat', 'other']
TAG_SCHEMA = {'type': 'object', 'properties': {'tag': {'type': 'string', 'enum': TAGS},
              'description': {'type': 'string'}, 'confidence': {'type': 'number'}},
              'required': ['tag', 'description', 'confidence']}


async def tag_photo(image_bytes: bytes, mime: str, site_name: str) -> dict:
    prompt = (f'Jobsite photo from {site_name}, a power plant site. Classify the hazard into exactly one tag and write one '
              'sentence, at most 160 characters, describing it for a crew briefing. confidence is your probability (0 to 1) '
              'that the tag is right. If nothing hazardous is visible, use other.')
    try:
        out = await generate([types.Part.from_bytes(data=image_bytes, mime_type=mime), prompt], TAG_SCHEMA)
    except Exception:
        # The report must still save if Gemini is down; confidence 0 makes the crew page show the tag as a suggestion.
        log.exception('tag_photo failed')
        return {'tag': 'other', 'description': 'Photo saved. Automatic tagging is unavailable right now.', 'confidence': 0.0}
    return {'tag': out['tag'] if out['tag'] in TAGS else 'other', 'description': out['description'][:160],
            'confidence': min(1.0, max(0.0, float(out['confidence'])))}


# --- 7.3 the 6 PM briefing --------------------------------------------------------

BRIEFING_SCHEMA = {'type': 'object', 'properties': {'english': {'type': 'string'}, 'spanish': {'type': 'string'}},
                   'required': ['english', 'spanish']}


async def briefing(payload: dict) -> tuple[dict, str]:
    """Returns ({english, spanish}, source) where source is 'gemini' or 'template'."""
    prompt = ('Write a next day safety briefing for a utility field crew, plain language, 120 words or fewer, in English and '
              'in Spanish. Use only the numbers in this payload and add no others: no percentages, times, distances, or '
              'counts that are not written in it. Write times exactly as they appear in the payload. '
              'Lead with the single biggest risk. It is read aloud to the crew, so write it the way a foreman talks: '
              'say "tomorrow" instead of the date, never read out field names, and skip anything that is none or empty. '
              'Payload: ' + json.dumps(payload, ensure_ascii=False))
    for attempt in range(2):
        try:
            out = await generate(prompt, BRIEFING_SCHEMA)
        except Exception:
            log.exception('briefing call failed')
            break
        bad = invented(out['english'], payload) | invented(out['spanish'], payload)
        if not bad:
            return {'english': out['english'], 'spanish': out['spanish']}, 'gemini'
        log.warning('briefing attempt %d invented %s', attempt + 1, sorted(bad))
        prompt += ' Your last answer used numbers that are not in the payload. Use only payload numbers.'
    return template_briefing(payload), 'template'


def template_briefing(p: dict) -> dict:
    """Built from the payload alone, so it can never invent a number."""
    en, es = [], []
    hi, rain, mm, gust = p.get('heat_index_max_f'), p.get('rain_chance_pct'), p.get('rain_mm'), p.get('gust_max_kmh')
    if p.get('nws_alerts'):
        en.append(f"Active weather alert: {', '.join(p['nws_alerts'])}.")
        es.append(f"Alerta meteorológica activa: {', '.join(p['nws_alerts'])}.")
    if p.get('flood_status') not in (None, 'none'):
        en.append(f"Flood status is {p['flood_status'].replace('_', ' ')}. Stay out of standing water.")
        es.append(f"Estado de inundación: {p['flood_status'].replace('_', ' ')}. No entren en agua estancada.")
    if hi is not None and hi >= 103:
        en.append(f'Heat index reaches {hi} F. Take shaded water breaks every hour and watch each other for heat illness.')
        es.append(f'El índice de calor llega a {hi} F. Tomen descansos con agua a la sombra cada hora y vigílense entre ustedes.')
    elif hi is not None:
        en.append(f'Heat index peaks at {hi} F.')
        es.append(f'El índice de calor máximo es {hi} F.')
    if rain is not None:
        when = f" starting around {p['storm_start']}" if p.get('storm_start') else ''
        cuando = f" a partir de las {p['storm_start']}" if p.get('storm_start') else ''
        en.append(f'Chance of rain {rain} percent with {mm} mm expected{when}. If you hear thunder, stop work and get to the trucks.')
        es.append(f'Probabilidad de lluvia de {rain} por ciento con {mm} mm esperados{cuando}. Si oyen truenos, paren el trabajo y vayan a los camiones.')
    if gust is not None:
        en.append(f'Wind gusts up to {gust} km/h.')
        es.append(f'Ráfagas de viento de hasta {gust} km/h.')
    if p.get('hazard_index') is not None:
        en.append(f"Hazard index for tomorrow is {p['hazard_index']} out of 10.")
        es.append(f"El índice de peligro para mañana es {p['hazard_index']} de 10.")
    if p.get('open_reports'):
        tags = ', '.join(sorted({r['tag'].replace('_', ' ') for r in p['open_reports']}))
        en.append(f'Open hazard reports on site: {tags}.')
        es.append(f'Reportes de peligro abiertos en el sitio: {tags}.')
    return {'english': f"Briefing for {p['site']}. " + ' '.join(en), 'spanish': f"Informe para {p['site']}. " + ' '.join(es)}


# --- 7.4 index explanation ----------------------------------------------------------

async def explain(site_name: str, index: int, top_features: list[dict]) -> tuple[str, str]:
    """One sentence a crew lead would say. Returns (sentence, source), source 'gemini' or 'template'."""
    payload = {'site': site_name, 'index': index, 'scale': '0 to 10', 'reasons': [f['label'] for f in top_features]}
    prompt = ('In one sentence a crew lead would say out loud, explain why this site scored this hazard index for tomorrow, '
              'using only these reasons and only numbers that appear in the payload. Payload: ' + json.dumps(payload))
    schema = {'type': 'object', 'properties': {'sentence': {'type': 'string'}}, 'required': ['sentence']}
    for attempt in range(2):
        try:
            out = await generate(prompt, schema)
        except Exception:
            log.exception('explain call failed')
            break
        if not invented(out['sentence'], payload):
            return out['sentence'], 'gemini'
        prompt += ' Your last answer used a number that is not in the payload. Use only payload numbers.'
    reasons = ', '.join(payload['reasons']) or 'no single weather factor'
    return f"{site_name} scores {index} out of 10 for tomorrow, driven by {reasons}.", 'template'
