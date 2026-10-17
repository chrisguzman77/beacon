import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useRef } from 'react'
import type { FeatureCollection } from 'geojson'
import type { SiteRow } from '@/api'
import { color, hazard, indexStops } from '@/tokens'

// MapTiler satellite with terrain when VITE_MAPTILER_KEY is set; otherwise the free
// CARTO dark basemap (no key) so the sites still show. Sites: circle colored by index, ring when crew are on
// site, pulsing red halo on active stop work, white outline on the beacon site.

// MapLibre 6 loads tiles in a module worker; Vite has to bundle it and hand over the URL.
maplibregl.setWorkerUrl(workerUrl)

const key = import.meta.env.VITE_MAPTILER_KEY

const style: maplibregl.StyleSpecification | string = key
  ? {
      version: 8,
      sources: {
        sat: { type: 'raster', tiles: [`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${key}`], tileSize: 256, attribution: '© MapTiler © OpenStreetMap' },
        terrain: { type: 'raster-dem', tiles: [`https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=${key}`], tileSize: 256, encoding: 'mapbox' },
      },
      layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
    }
  : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

function geojson(sites: SiteRow[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: sites.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: {
        id: s.site_id, name: s.name, index: s.index ?? 0, crew: s.crew_on_site, beacon: s.beacon,
        stop: s.alerts.some((a) => a.type === 'stopwork'),
      },
    })),
  }
}

type Props = { sites: SiteRow[]; selected: number | null; onSelect: (id: number) => void }

export default function MapView({ sites, selected, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const ready = useRef(false)
  const latest = useRef({ sites, onSelect })
  latest.current = { sites, onSelect }

  useEffect(() => {
    const m = new maplibregl.Map({ container: ref.current!, style, center: [-84.5, 29.5], zoom: 5.2, attributionControl: { compact: true } })
    map.current = m
    let raf = 0
    m.on('load', () => {
      if (key) {
        m.setTerrain({ source: 'terrain', exaggeration: 1.2 })
        m.setSky({ 'sky-color': '#9ec4e8', 'horizon-color': '#dfe9f3', 'fog-color': '#ffffff', 'sky-horizon-blend': 0.6 })
      }
      m.addSource('sites', { type: 'geojson', data: geojson(latest.current.sites) })
      m.addLayer({ id: 'halo', type: 'circle', source: 'sites', filter: ['==', ['get', 'stop'], true],
        paint: { 'circle-radius': 18, 'circle-color': hazard.stopwork, 'circle-opacity': 0.35, 'circle-blur': 0.4 } })
      m.addLayer({ id: 'crew', type: 'circle', source: 'sites', filter: ['>', ['get', 'crew'], 0],
        paint: { 'circle-radius': 13, 'circle-color': 'transparent', 'circle-stroke-width': 2, 'circle-stroke-color': color.signal } })
      m.addLayer({ id: 'site', type: 'circle', source: 'sites',
        paint: {
          'circle-radius': ['case', ['get', 'beacon'], 9, 7],
          'circle-color': ['step', ['get', 'index'], indexStops.low, 4, indexStops.mid, 7, indexStops.high],
          'circle-stroke-width': ['case', ['get', 'beacon'], 3, 1.5],
          'circle-stroke-color': ['case', ['get', 'beacon'], '#ffffff', color.bg],
        } })
      m.on('click', 'site', (e) => {
        const id = e.features?.[0]?.properties?.id
        if (id) latest.current.onSelect(Number(id))
      })
      m.on('mouseenter', 'site', () => (m.getCanvas().style.cursor = 'pointer'))
      m.on('mouseleave', 'site', () => (m.getCanvas().style.cursor = ''))
      ready.current = true
      const pulse = (t: number) => {
        const k = (Math.sin(t / 300) + 1) / 2
        m.setPaintProperty('halo', 'circle-radius', 14 + k * 14)
        m.setPaintProperty('halo', 'circle-opacity', 0.55 - k * 0.35)
        raf = requestAnimationFrame(pulse)
      }
      raf = requestAnimationFrame(pulse)
    })
    return () => {
      cancelAnimationFrame(raf)
      ready.current = false
      m.remove()
    }
  }, [])

  useEffect(() => {
    if (ready.current) (map.current?.getSource('sites') as maplibregl.GeoJSONSource | undefined)?.setData(geojson(sites))
  }, [sites])

  useEffect(() => {
    const s = sites.find((x) => x.site_id === selected)
    if (s && map.current) map.current.flyTo({ center: [s.lon, s.lat], zoom: key ? 15 : 8, pitch: key ? 60 : 0, duration: 2200 })
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={ref} className="h-full w-full" />
}
