import { useState } from 'react'

// English and Spanish for the crew phone page, matching the bilingual briefings. The choice is
// remembered on the phone; a phone set to Spanish starts in Spanish. The beacon's alert reasons
// are translated too. AI photo tags and backend messages arrive in English and stay as sent.

export type Lang = 'en' | 'es'

const en = {
  crew: 'Crew',
  signInTitle: 'Crew sign in',
  signInBody: 'Sign in once and this phone remembers you.',
  signIn: 'Sign in',
  yourSite: 'Your site',
  yourName: 'Your name',
  firstName: 'First name',
  nearestFirst: 'Nearest sites first',
  pickSite: 'Pick your site',
  listFailed: 'The site list did not load. Check the signal.',
  loadingSites: 'Loading sites…',
  retry: 'Retry',
  useSite: 'Use this site',
  stopWork: 'STOP WORK',
  leaveZone: 'Leave the work zone now',
  allClear: 'All clear on site',
  notConnected: 'Not connected to the site yet',
  connecting: 'Connecting to the site…',
  onSite: 'On site',
  offSite: 'Off site',
  checkedInAt: (t: string) => `Checked in at ${t}`,
  checkedIn: 'Checked in',
  checkInHint: 'Check in when you arrive so the beacon counts you',
  imOn: "I'M ON SITE",
  imLeaving: "I'M LEAVING",
  reportHazard: 'REPORT HAZARD',
  photoAlt: 'The hazard photo',
  discard: 'Discard photo',
  saved: 'Saved and pinned to the site',
  sure: (n: number) => `${n}% sure`,
  another: 'Report another',
  note: 'Add a note (optional)',
  sending: 'Sending…',
  send: 'SEND REPORT',
  signInDemo: 'Continue',
  signInDemoBody: 'Demo sign in. With the live system this is your company login.',
  findName: 'Find your name',
  addMe: (n: string) => `Add "${n}" as new crew`,
  noNames: 'No names yet. Type yours to add it.',
  yourLocation: 'Your location',
  useMyLocation: 'Use my location',
  nearestIs: (site: string, mi: number) => `Nearest site: ${site} · ${mi} mi`,
  locating: 'Finding your location…',
  locationOff: 'Location is off. Pick your site below.',
  otherSites: 'Other sites',
  start: 'Connect to this beacon',
  conditions: 'Conditions at your site',
  tapCondition: 'Tap a condition to see what to do',
  changeSite: 'Change site',
  logOut: 'Log out',
  changeTitle: 'Change site',
  changeBody: (site: string) => `Changing site needs a supervisor. You will be checked out of ${site} first.`,
  supervisorPin: 'Supervisor PIN',
  approve: 'Approve',
  cancel: 'Cancel',
  wrongPin: 'Wrong PIN',
  needsSupervisor: 'A supervisor needs to sign in on this phone to approve.',
  supervisorSignIn: 'Supervisor sign in',
  status: { danger: 'Danger', caution: 'Caution', ok: 'Normal', info: '' } as Record<string, string>,
  factor: {} as Record<string, string>,
}

const es: typeof en = {
  crew: 'Equipo',
  signInTitle: 'Acceso del equipo',
  signInBody: 'Inicia sesión una vez y este teléfono te recordará.',
  signIn: 'Iniciar sesión',
  yourSite: 'Tu sitio',
  yourName: 'Tu nombre',
  firstName: 'Nombre',
  nearestFirst: 'Sitios más cercanos primero',
  pickSite: 'Elige tu sitio',
  listFailed: 'La lista de sitios no cargó. Revisa la señal.',
  loadingSites: 'Cargando sitios…',
  retry: 'Reintentar',
  useSite: 'Usar este sitio',
  stopWork: 'DETENGA EL TRABAJO',
  leaveZone: 'Salga de la zona de trabajo ahora',
  allClear: 'Todo despejado en el sitio',
  notConnected: 'Aún sin conexión con el sitio',
  connecting: 'Conectando con el sitio…',
  onSite: 'En el sitio',
  offSite: 'Fuera del sitio',
  checkedInAt: (t: string) => `Registrado a las ${t}`,
  checkedIn: 'Registrado',
  checkInHint: 'Regístrate al llegar para que la baliza te cuente',
  imOn: 'YA LLEGUÉ',
  imLeaving: 'ME VOY',
  reportHazard: 'REPORTAR PELIGRO',
  photoAlt: 'Foto del peligro',
  discard: 'Descartar foto',
  saved: 'Guardado y marcado en el sitio',
  sure: (n: number) => `${n}% seguro`,
  another: 'Reportar otro',
  note: 'Agrega una nota (opcional)',
  sending: 'Enviando…',
  send: 'ENVIAR REPORTE',
  signInDemo: 'Continuar',
  signInDemoBody: 'Acceso de prueba. En el sistema real es tu acceso de la empresa.',
  findName: 'Busca tu nombre',
  addMe: (n: string) => `Agregar "${n}" como nuevo`,
  noNames: 'Aún no hay nombres. Escribe el tuyo para agregarlo.',
  yourLocation: 'Tu ubicación',
  useMyLocation: 'Usar mi ubicación',
  nearestIs: (site: string, mi: number) => `Sitio más cercano: ${site} · ${mi} mi`,
  locating: 'Buscando tu ubicación…',
  locationOff: 'La ubicación está apagada. Elige tu sitio abajo.',
  otherSites: 'Otros sitios',
  start: 'Conectar a esta baliza',
  conditions: 'Condiciones en tu sitio',
  tapCondition: 'Toca una condición para ver qué hacer',
  changeSite: 'Cambiar de sitio',
  logOut: 'Cerrar sesión',
  changeTitle: 'Cambiar de sitio',
  changeBody: (site: string) => `Cambiar de sitio requiere un supervisor. Primero se cerrará tu registro en ${site}.`,
  supervisorPin: 'PIN del supervisor',
  approve: 'Aprobar',
  cancel: 'Cancelar',
  wrongPin: 'PIN incorrecto',
  needsSupervisor: 'Un supervisor debe iniciar sesión en este teléfono para aprobar.',
  supervisorSignIn: 'Acceso de supervisor',
  status: { danger: 'Peligro', caution: 'Precaución', ok: 'Normal', info: '' },
  factor: {
    heat: 'Índice de calor', temp: 'Temperatura', humidity: 'Humedad', lightning: 'Rayos', wind: 'Ráfagas de viento', rain: 'Lluvia 24 h',
    water: 'Agua estancada', flood: 'Aviso de inundación', soil: 'Saturación del suelo', river: 'Nivel del río', zone_fema: 'Zona de inundación',
    wildlife: 'Fauna', equipment: 'Equipo', tilt: 'Inclinación de la baliza', zone: 'Zona de trabajo', link: 'Conexión',
  },
}

export const crewText = { en, es }
export type CrewText = typeof en

const KEY = 'omnirisk.crew.lang'

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'en' || saved === 'es') return saved
  } catch {
    /* fall through to the phone's language */
  }
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function useCrewLang(): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>(initial)
  const choose = (l: Lang) => {
    setLang(l)
    try {
      localStorage.setItem(KEY, l)
    } catch {
      /* remembered for this visit only */
    }
  }
  return [lang, choose]
}

// The beacon's reason line ("LIGHTNING 8 MI") as a sentence in the crew's language.
export function reasonIn(reason: string, lang: Lang) {
  const sentence = (r: string) => r.toLowerCase().replace(/^./, (c) => c.toUpperCase())
  if (lang === 'en') return sentence(reason)
  const r = reason.toUpperCase()
  const n = r.match(/(\d+)/)?.[1]
  if (r.startsWith('LIGHTNING')) return n ? `Rayo a ${n} mi` : 'Rayo cerca'
  if (r.startsWith('HEAT INDEX')) return `Índice de calor ${n ?? ''}`.trim()
  if (r === 'HEAT DANGER') return 'Peligro por calor'
  if (r === 'HEAT WARNING') return 'Aviso de calor'
  if (r === 'FLOOD CONFIRMED') return 'Inundación confirmada'
  if (r === 'FLOOD WARNING') return 'Aviso de inundación'
  if (r.startsWith('E-STOP')) return 'Paro de emergencia activado'
  if (r.startsWith('BEACON')) return 'Baliza insegura, revise el montaje'
  return sentence(reason)
}
