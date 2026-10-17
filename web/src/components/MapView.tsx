import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'

const key = import.meta.env.VITE_MAPTILER_KEY

export default function MapView() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!key || !ref.current) return
    const map = new maplibregl.Map({
      container: ref.current, center: [-82.3, 29.6], zoom: 6, pitch: 0,
      style: {
        version: 8,
        sources: {
          sat: { type: 'raster', tiles: [`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${key}`], tileSize: 256, attribution: '© MapTiler © OpenStreetMap' },
          terrain: { type: 'raster-dem', tiles: [`https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=${key}`], tileSize: 256, encoding: 'mapbox' },
        },
        layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
      },
    })
    map.on('load', () => {
      map.setTerrain({ source: 'terrain', exaggeration: 1.2 })
      map.setSky({ 'sky-color': '#9ec4e8', 'horizon-color': '#dfe9f3', 'fog-color': '#ffffff', 'sky-horizon-blend': 0.6 })
    })
    return () => map.remove()
  }, [])

  if (!key)
    return (
      <div className="flex h-full items-center justify-center bg-surface text-dim">
        The map needs a MapTiler key. Set VITE_MAPTILER_KEY in web/.env and restart the dev server.
      </div>
    )
  return <div ref={ref} className="h-full w-full" />
}
