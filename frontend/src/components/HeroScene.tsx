'use client'

import type { MotionValue } from 'motion/react'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const GRID = 22
const SPACING = 1.35

/** Animated low-poly skyline in cardinal and gold. Purely decorative.
 *  `progress` (0 to 1) flies the camera down into the city as the page scrolls. */
export default function HeroScene({ progress }: { progress?: MotionValue<number> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const progressRef = useRef(progress)
  progressRef.current = progress

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    if (!canvas || !host) return

    let renderer: THREE.WebGLRenderer
    try {
      // On high-density screens the extra pixels already smooth edges, so MSAA is skipped there.
      renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 1.5, alpha: true, powerPreference: 'high-performance' })
    } catch {
      return // No WebGL: the CSS gradient behind the canvas stays visible.
    }
    // A full-screen lit scene is fill-rate bound: 1.25x looks the same behind the fog and
    // gradients but draws about half the pixels of 1.75x.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25))

    const readBg = () =>
      new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0c0505')
    const scene = new THREE.Scene()
    const fog = new THREE.Fog(readBg(), 16, 46)
    scene.fog = fog

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    const city = new THREE.Group()
    scene.add(city)

    // Buildings: one instanced box, scaled per instance each frame.
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
    const material = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.3 })
    const count = GRID * GRID
    const mesh = new THREE.InstancedMesh(box, material, count)
    const base = new Float32Array(count)
    const color = new THREE.Color()
    const cardinal = new THREE.Color('#990000')
    const gold = new THREE.Color('#ffcc00')
    for (let i = 0; i < count; i++) {
      const gx = (i % GRID) - GRID / 2
      const gz = Math.floor(i / GRID) - GRID / 2
      const dist = Math.hypot(gx, gz) / (GRID / 2)
      // Taller toward the middle, with a few standouts.
      base[i] = 0.4 + Math.random() * 2.2 + Math.max(0, 1 - dist) * Math.random() * 5.5
      if (Math.random() < 0.09) color.copy(gold)
      else color.copy(cardinal).multiplyScalar(0.55 + Math.random() * 0.9)
      mesh.setColorAt(i, color)
    }
    city.add(mesh)

    // Drifting gold sparks.
    const sparks = 420
    const positions = new Float32Array(sparks * 3)
    for (let i = 0; i < sparks; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40
      positions[i * 3 + 1] = Math.random() * 16
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40
    }
    const sparkGeo = new THREE.BufferGeometry()
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const sparkMat = new THREE.PointsMaterial({
      color: 0xffcc00,
      size: 0.09,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
    const points = new THREE.Points(sparkGeo, sparkMat)
    scene.add(points)

    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const sun = new THREE.DirectionalLight(0xffd36b, 2.4)
    sun.position.set(8, 14, 6)
    scene.add(sun)
    const ember = new THREE.PointLight(0xff2a1a, 60, 40)
    ember.position.set(-6, 6, 4)
    scene.add(ember)

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
    const onMove = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('pointermove', onMove, { passive: true })

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

    const themeWatch = new MutationObserver(() => fog.color.copy(readBg()))
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    let visible = true
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting))
    io.observe(host)

    const dummy = new THREE.Object3D()
    const clock = new THREE.Clock()
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      if (!visible || document.hidden) return
      const t = clock.getElapsedTime()
      pointer.x += (pointer.tx - pointer.x) * 0.04
      pointer.y += (pointer.ty - pointer.y) * 0.04

      for (let i = 0; i < count; i++) {
        const gx = (i % GRID) - GRID / 2
        const gz = Math.floor(i / GRID) - GRID / 2
        const wave = 0.72 + 0.28 * Math.sin(t * 0.9 + gx * 0.4 + gz * 0.33)
        dummy.position.set(gx * SPACING, 0, gz * SPACING)
        dummy.scale.set(1, base[i] * wave, 1)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true

      city.rotation.y = t * 0.045 + pointer.x * 0.28 + (progressRef.current?.get() ?? 0) * 0.9
      points.rotation.y = -t * 0.02
      const pos = sparkGeo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < sparks; i++) {
        const y = pos.getY(i) + 0.012
        pos.setY(i, y > 16 ? 0 : y)
      }
      pos.needsUpdate = true

      const p = progressRef.current?.get() ?? 0
      const dive = p * p * (3 - 2 * p) // smoothstep
      fog.near = 16 - dive * 12
      fog.far = 46 - dive * 22
      camera.position.set(pointer.x * 2.2 * (1 - dive), 8.5 - pointer.y * 1.6 - dive * 5.6, 23 - dive * 17)
      camera.lookAt(0, 2.2 + dive * 0.8, 0)
      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      ro.disconnect()
      io.disconnect()
      themeWatch.disconnect()
      box.dispose()
      material.dispose()
      sparkGeo.dispose()
      sparkMat.dispose()
      mesh.dispose()
      renderer.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-hidden />
}
