'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { laPhase, SKY } from '@/lib/la'
import { PIN_COLOR, type CityFocus, type CityPin } from './shared'

/* A stylised 3D model of the blocks around USC, drawn to scale from real coordinates.
   Listings stand as glowing pins (taller = pricier), walk-time rings ripple out from campus,
   and in flyover mode the camera glides in from above to one building. The surrounding blocks
   are generated, not real footprints: the pins, rings and focus building are the real data. */

export const CAMPUS = { lat: 34.0205, lng: -118.2856 }
const M_PER_UNIT = 40
const M_PER_DEG_LAT = 111_320
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((CAMPUS.lat * Math.PI) / 180)
// Mirrors the API's walk estimate: 3 mph and 30% extra for real streets.
const WALK_RINGS = [5, 10, 15, 20]
const ringRadius = (min: number) => ((min / 60) * 3 * 1609.34) / 1.3 / M_PER_UNIT
const CITY_RADIUS = 78
const BLOCK = 3.2

export const toScene = (lat: number, lng: number) =>
  new THREE.Vector3(((lng - CAMPUS.lng) * M_PER_DEG_LNG) / M_PER_UNIT, 0, (-(lat - CAMPUS.lat) * M_PER_DEG_LAT) / M_PER_UNIT)

// Small deterministic RNG so the generated blocks look the same on every visit.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export default function CityScene({
  pins = [],
  focus = null,
  rings = true,
  highlight = null,
  onSelect,
  onArrive,
  className = '',
  label,
}: {
  pins?: CityPin[]
  focus?: CityFocus | null
  rings?: boolean
  highlight?: number | null
  onSelect?: (id: number | null) => void
  onArrive?: () => void
  className?: string
  label: string
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const api = useRef<{ setPins: (p: CityPin[]) => void; zoom: (f: number) => void; reset: () => void; highlight: (id: number | null) => void } | null>(null)
  const cb = useRef({ onSelect, onArrive })
  cb.current = { onSelect, onArrive }
  const [failed, setFailed] = useState(false)
  const [hint, setHint] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    const host = hostRef.current
    const overlay = overlayRef.current
    if (!canvas || !host || !overlay) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 1.5, alpha: true })
    } catch {
      setFailed(true)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))

    const css = (v: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || fallback
    const scene = new THREE.Scene()
    const fog = new THREE.Fog(new THREE.Color(css('--bg', '#0c0505')), 60, 190)
    scene.fog = fog
    const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 600)
    const controls = new OrbitControls(camera, canvas)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = 1.32
    controls.minDistance = 10
    controls.maxDistance = 190
    controls.autoRotate = !reduce
    controls.autoRotateSpeed = 0.35
    controls.screenSpacePanning = false

    /* ---------- Light: follows the time of day in Los Angeles ---------- */
    const sky = SKY[laPhase()]
    const night = laPhase() === 'night' || laPhase() === 'dusk'
    scene.add(new THREE.AmbientLight(sky.ambient, sky.ambientIntensity))
    const sun = new THREE.DirectionalLight(sky.sun, sky.sunIntensity)
    sun.position.set(-40, 60, 30)
    scene.add(sun)
    const campusGlow = new THREE.PointLight(0xffcc00, sky.glow * 3, 70, 1.6)
    campusGlow.position.set(0, 10, 0)
    scene.add(campusGlow)

    /* ---------- Ground and street grid ---------- */
    const groundMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(css('--surface', '#170909')), roughness: 1 })
    const ground = new THREE.Mesh(new THREE.CircleGeometry(CITY_RADIUS * 2.2, 64).rotateX(-Math.PI / 2), groundMat)
    scene.add(ground)
    const grid = new THREE.GridHelper(CITY_RADIUS * 2.4, Math.round((CITY_RADIUS * 2.4) / BLOCK), 0x990000, 0x5c0000)
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.35
    grid.position.y = 0.01
    scene.add(grid)

    /* ---------- Generated blocks ---------- */
    const focusPos = focus ? toScene(focus.lat, focus.lng) : null
    const rand = rng(2026)
    const boxes: { x: number; z: number; w: number; d: number; h: number; c: THREE.Color }[] = []
    const cardinal = new THREE.Color('#990000')
    const gold = new THREE.Color('#ffcc00')
    for (let bx = -CITY_RADIUS; bx < CITY_RADIUS; bx += BLOCK) {
      for (let bz = -CITY_RADIUS; bz < CITY_RADIUS; bz += BLOCK) {
        const cx = bx + BLOCK / 2
        const cz = bz + BLOCK / 2
        const r = Math.hypot(cx, cz)
        if (r > CITY_RADIUS) continue
        const onCampus = Math.abs(cx) < 9 && Math.abs(cz) < 8
        const lots = onCampus ? 1 : 1 + Math.floor(rand() * 3)
        for (let l = 0; l < lots; l++) {
          const w = onCampus ? 1.6 + rand() * 0.8 : 0.7 + rand() * 1.1
          const d = onCampus ? 1.2 + rand() * 1 : 0.7 + rand() * 1.1
          const x = cx + (rand() - 0.5) * (BLOCK - w - 0.6)
          const z = cz + (rand() - 0.5) * (BLOCK - d - 0.6)
          if (focusPos && Math.hypot(x - focusPos.x, z - focusPos.z) < 2.2) continue
          if (rand() < 0.12) continue
          // Taller toward downtown (north-east) and along Figueroa, low on campus.
          const towardDowntown = Math.max(0, -z * 0.6 + x * 0.4) / CITY_RADIUS
          const h = onCampus ? 0.9 + rand() * 1.6 : 0.5 + rand() * 1.8 + towardDowntown * rand() * 9
          const c = onCampus
            ? gold.clone().multiplyScalar(0.5 + rand() * 0.35)
            : rand() < 0.04
              ? gold.clone().multiplyScalar(0.7)
              : cardinal.clone().multiplyScalar(0.35 + rand() * 0.6)
          boxes.push({ x, z, w, d, h, c })
        }
      }
    }
    const boxGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    const boxMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.25 })
    if (night) {
      boxMat.emissive = new THREE.Color('#2a0400')
      boxMat.emissiveIntensity = 1
    }
    const blocks = new THREE.InstancedMesh(boxGeo, boxMat, boxes.length)
    const m4 = new THREE.Object3D()
    const grow = new Float32Array(boxes.length)
    boxes.forEach((b, i) => {
      m4.position.set(b.x, 0, b.z)
      m4.scale.set(b.w, reduce ? b.h : 0.001, b.d)
      m4.updateMatrix()
      blocks.setMatrixAt(i, m4.matrix)
      blocks.setColorAt(i, b.c)
      grow[i] = Math.hypot(b.x, b.z) / CITY_RADIUS // build-up ripples out from campus
    })
    scene.add(blocks)

    /* ---------- Campus beacon ---------- */
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 30, 12, 1, true).translate(0, 15, 0),
      new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }),
    )
    scene.add(beacon)

    /* ---------- Focus building (flyover) ---------- */
    let focusGroup: THREE.Group | null = null
    if (focusPos) {
      focusGroup = new THREE.Group()
      focusGroup.position.copy(focusPos)
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 6.5, 2.4).translate(0, 3.25, 0),
        new THREE.MeshStandardMaterial({ color: 0x990000, emissive: 0x550000, roughness: 0.35, metalness: 0.5 }),
      )
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(tower.geometry),
        new THREE.LineBasicMaterial({ color: 0xffcc00 }),
      )
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(2.4, 2.9, 48).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
      )
      halo.position.y = 0.05
      const light = new THREE.PointLight(0xffcc00, 120, 18, 1.5)
      light.position.y = 8
      focusGroup.add(tower, edges, halo, light)
      scene.add(focusGroup)
    }

    /* ---------- Walk rings and the ripple ---------- */
    const ringGroup = new THREE.Group()
    const ripple = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
    )
    if (rings) {
      for (const min of WALK_RINGS) {
        const r = ringRadius(min)
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(r - 0.12, r + 0.12, 128).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
        )
        ring.position.y = 0.03
        ringGroup.add(ring)
      }
      ripple.position.y = 0.04
      if (!reduce) ringGroup.add(ripple)
      scene.add(ringGroup)
    }

    /* ---------- Listing pins ---------- */
    const MAX_PINS = 600
    const beamGeo = new THREE.CylinderGeometry(0.07, 0.07, 1, 6).translate(0, 0.5, 0)
    const headGeo = new THREE.SphereGeometry(0.45, 16, 12)
    const beamMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: focusPos ? 0.3 : 0.55, depthWrite: false })
    const headMat = new THREE.MeshBasicMaterial()
    const beams = new THREE.InstancedMesh(beamGeo, beamMat, MAX_PINS)
    const heads = new THREE.InstancedMesh(headGeo, headMat, MAX_PINS)
    beams.count = heads.count = 0
    scene.add(beams, heads)
    let pinData: (CityPin & { pos: THREE.Vector3; h: number; born: number })[] = []
    let hovered = -1
    let highlighted: number | null = null
    const clock = new THREE.Clock()

    const setPins = (list: CityPin[]) => {
      const now = clock.getElapsedTime()
      pinData = list.slice(0, MAX_PINS).map((p, i) => ({
        ...p,
        pos: toScene(p.lat, p.lng),
        h: (2.2 + Math.max(0, Math.min(1, (p.rent - 700) / 3000)) * 9) * (focusPos ? 0.4 : 1),
        born: now + (reduce ? -10 : 0.6 + i * 0.004),
      }))
      const col = new THREE.Color()
      pinData.forEach((p, i) => {
        col.set(PIN_COLOR[p.kind])
        beams.setColorAt(i, col)
        heads.setColorAt(i, col)
      })
      beams.count = heads.count = pinData.length
      if (beams.instanceColor) beams.instanceColor.needsUpdate = true
      if (heads.instanceColor) heads.instanceColor.needsUpdate = true
    }

    /* ---------- Labels drawn in HTML over the canvas ---------- */
    const labels: { el: HTMLElement; pos: THREE.Vector3 }[] = []
    const addLabel = (text: string, pos: THREE.Vector3, cls: string) => {
      const el = document.createElement('span')
      el.className = cls
      el.textContent = text
      overlay.appendChild(el)
      labels.push({ el, pos })
    }
    addLabel('USC', new THREE.Vector3(0, 4, 0), 'city-label city-label-campus')
    if (rings) for (const min of WALK_RINGS) addLabel(`${min} min walk`, new THREE.Vector3(ringRadius(min) * 0.8, 0.3, ringRadius(min) * 0.6), 'city-label city-label-ring')
    if (focus && focusPos) addLabel(focus.label, focusPos.clone().setY(8.4), 'city-label city-label-focus')

    /* ---------- Camera: overview, or a flyover onto the focus ---------- */
    const overview = { pos: new THREE.Vector3(38, 46, 62), target: new THREE.Vector3(0, 0, 4) }
    const arrive = focusPos
      ? { pos: focusPos.clone().add(new THREE.Vector3(11, 9, 14)), target: focusPos.clone().setY(2.5) }
      : overview
    const flight = focusPos && !reduce ? { from: new THREE.Vector3(0, 150, 95), fromTarget: new THREE.Vector3(0, 0, 0), start: 0.25, dur: 3.2 } : null
    if (flight) {
      camera.position.copy(flight.from)
      controls.target.copy(flight.fromTarget)
      controls.enabled = false
      controls.autoRotate = false
    } else {
      camera.position.copy(arrive.pos)
      controls.target.copy(arrive.target)
      if (focusPos) cb.current.onArrive?.()
    }
    let arrived = !flight
    controls.update()

    /* ---------- Input: hover, click, zoom without hijacking page scroll ---------- */
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2(-9, -9)
    let downAt = { x: 0, y: 0 }
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    }
    const onLeave = () => ndc.set(-9, -9)
    const onDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY }
      controls.autoRotate = false
      setHint(false)
    }
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return
      cb.current.onSelect?.(hovered >= 0 ? pinData[hovered].id : null)
    }
    // The page keeps scrolling over the scene; Ctrl/⌘ + wheel (or pinch) zooms.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) e.stopImmediatePropagation()
      else setHint(false)
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('wheel', onWheel, { capture: true })

    const zoom = (f: number) => {
      const off = camera.position.clone().sub(controls.target).multiplyScalar(f)
      const len = THREE.MathUtils.clamp(off.length(), controls.minDistance, controls.maxDistance)
      camera.position.copy(controls.target).add(off.setLength(len))
      controls.autoRotate = false
    }
    const reset = () => {
      camera.position.copy(arrive.pos)
      controls.target.copy(arrive.target)
    }
    api.current = { setPins, zoom, reset, highlight: (id) => {
        highlighted = id
      } }
    setPins(pins)

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()
    const themeWatch = new MutationObserver(() => {
      fog.color.set(css('--bg', '#0c0505'))
      groundMat.color.set(css('--surface', '#170909'))
    })
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    let visible = true
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(host)

    /* ---------- Frame loop ---------- */
    const v = new THREE.Vector3()
    const tip = tipRef.current
    let frame = 0
    let introT0: number | null = null
    const tick = () => {
      frame = requestAnimationFrame(tick)
      if (!visible || document.hidden) return
      const t = clock.getElapsedTime()
      // Intro animations start the first time the scene is actually on screen.
      if (introT0 === null) introT0 = t
      const ti = t - introT0

      // Blocks rise out of the ground, rippling outward from campus.
      if (!reduce && ti < 3.2) {
        boxes.forEach((b, i) => {
          const k = THREE.MathUtils.clamp((ti - grow[i] * 1.6) / 0.9, 0, 1)
          const e = 1 - Math.pow(1 - k, 3)
          m4.position.set(b.x, 0, b.z)
          m4.scale.set(b.w, Math.max(0.001, b.h * e), b.d)
          m4.updateMatrix()
          blocks.setMatrixAt(i, m4.matrix)
        })
        blocks.instanceMatrix.needsUpdate = true
      }

      if (flight && !arrived) {
        const k = THREE.MathUtils.clamp((ti - flight.start) / flight.dur, 0, 1)
        const e = easeInOut(k)
        camera.position.lerpVectors(flight.from, arrive.pos, e)
        // Arc: swing out a little on the way down.
        camera.position.x += Math.sin(e * Math.PI) * 18
        controls.target.lerpVectors(flight.fromTarget, arrive.target, e)
        camera.lookAt(controls.target)
        if (k >= 1) {
          arrived = true
          controls.enabled = true
          controls.autoRotate = !reduce
          controls.autoRotateSpeed = 0.6
          cb.current.onArrive?.()
        }
      } else {
        controls.update()
      }

      if (rings && !reduce) {
        const k = (t % 3.6) / 3.6
        const r = 0.5 + k * ringRadius(20)
        ripple.scale.set(r, 1, r)
        ;(ripple.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k)
      }
      ;(beacon.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.12 * Math.sin(t * 2)
      if (focusGroup) {
        const halo = focusGroup.children[2] as THREE.Mesh
        const s = 1 + 0.12 * Math.sin(t * 3)
        halo.scale.set(s, 1, s)
      }

      // Pins: grow in, bob, and swell on hover or highlight.
      ray.setFromCamera(ndc, camera)
      const hit = heads.count ? ray.intersectObject(heads, false)[0] : undefined
      const nextHover = hit?.instanceId ?? -1
      if (nextHover !== hovered) {
        hovered = nextHover
        canvas.style.cursor = hovered >= 0 ? 'pointer' : 'grab'
      }
      pinData.forEach((p, i) => {
        const k = THREE.MathUtils.clamp((t - p.born) / 0.7, 0, 1)
        const e = 1 - Math.pow(1 - k, 3)
        const on = i === hovered || p.id === highlighted
        const bob = reduce ? 0 : Math.sin(t * 2 + i) * 0.15
        m4.position.copy(p.pos)
        m4.scale.set(on ? 2 : 1, Math.max(0.001, p.h * e), on ? 2 : 1)
        m4.updateMatrix()
        beams.setMatrixAt(i, m4.matrix)
        m4.position.set(p.pos.x, p.h * e + bob, p.pos.z)
        const s = (on ? 1.9 : 1) * e
        m4.scale.set(s, s, s)
        m4.updateMatrix()
        heads.setMatrixAt(i, m4.matrix)
      })
      beams.instanceMatrix.needsUpdate = true
      heads.instanceMatrix.needsUpdate = true

      // HTML labels follow their 3D anchors.
      const { clientWidth: w, clientHeight: h } = host
      for (const l of labels) {
        v.copy(l.pos).project(camera)
        const hidden = v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1
        l.el.style.opacity = hidden ? '0' : ''
        l.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`
      }
      if (tip) {
        const idx = hovered >= 0 ? hovered : pinData.findIndex((p) => p.id === highlighted)
        if (idx >= 0) {
          const p = pinData[idx]
          v.copy(p.pos).setY(p.h + 1.2).project(camera)
          tip.style.opacity = '1'
          tip.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -110%)`
          if (tip.dataset.id !== String(p.id)) {
            tip.dataset.id = String(p.id)
            ;(tip.children[0] as HTMLElement).textContent = p.title
            ;(tip.children[1] as HTMLElement).textContent = p.sub
          }
        } else tip.style.opacity = '0'
      }
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(frame)
      api.current = null
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('wheel', onWheel, { capture: true })
      ro.disconnect()
      io.disconnect()
      themeWatch.disconnect()
      controls.dispose()
      labels.forEach((l) => l.el.remove())
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        mesh.geometry?.dispose()
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else mat?.dispose()
      })
      renderer.dispose()
    }
    // The scene is built once per focus; pins and highlight update through `api`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.lat, focus?.lng, rings])

  useEffect(() => {
    api.current?.setPins(pins)
  }, [pins])
  useEffect(() => {
    api.current?.highlight(highlight)
  }, [highlight])

  if (failed) {
    return (
      <div className={`grid place-items-center rounded-3xl border border-line bg-surface-2 p-6 text-center text-sm text-ink-soft ${className}`}>
        3D needs WebGL, which this browser has turned off. The flat map still works.
      </div>
    )
  }

  return (
    <div ref={hostRef} className={`city-scene relative overflow-hidden rounded-3xl border border-line ${className}`} role="img" aria-label={label}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,color-mix(in_srgb,var(--cardinal)_22%,transparent),transparent_70%)]" aria-hidden />
      <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden />
      <div ref={tipRef} className="city-tip pointer-events-none absolute top-0 left-0 opacity-0" aria-hidden>
        <strong />
        <span />
      </div>
      <div className="absolute right-3 bottom-3 flex flex-col gap-1.5">
        {[
          ['+', 'Zoom in', () => api.current?.zoom(0.75)],
          ['−', 'Zoom out', () => api.current?.zoom(1.33)],
          ['⟲', 'Reset view', () => api.current?.reset()],
        ].map(([sym, name, fn]) => (
          <button
            key={name as string}
            type="button"
            aria-label={name as string}
            onClick={fn as () => void}
            className="grid size-9 place-items-center rounded-full border border-line bg-bg/70 text-lg font-bold backdrop-blur hover:border-gold"
          >
            {sym as string}
          </button>
        ))}
      </div>
      {hint && (
        <p className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-bg/70 px-3 py-1.5 text-xs text-ink-soft backdrop-blur">
          Drag to orbit · Ctrl or ⌘ + scroll to zoom
        </p>
      )}
    </div>
  )
}
