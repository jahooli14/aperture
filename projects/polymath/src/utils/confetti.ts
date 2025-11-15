/**
 * Confetti Animation for Success Moments
 * Lightweight canvas-based confetti burst
 */

interface ConfettiOptions {
  particleCount?: number
  spread?: number
  startVelocity?: number
  decay?: number
  scalar?: number
  colors?: string[]
}

export function fireConfetti(options: ConfettiOptions = {}) {
  const {
    particleCount = 50,
    spread = 70,
    startVelocity = 30,
    decay = 0.9,
    scalar = 1,
    colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
  } = options

  // Create canvas if it doesn't exist
  let canvas = document.getElementById('confetti-canvas') as HTMLCanvasElement
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.id = 'confetti-canvas'
    canvas.style.position = 'fixed'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '9999'
    document.body.appendChild(canvas)
  }

  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Particle class
  class Particle {
    x: number
    y: number
    vx: number
    vy: number
    color: string
    size: number
    life: number
    rotation: number
    rotationSpeed: number

    constructor() {
      this.x = canvas.width / 2
      this.y = canvas.height / 2

      const angle = (Math.random() * spread - spread / 2) * (Math.PI / 180)
      const velocity = Math.random() * startVelocity
      this.vx = Math.cos(angle) * velocity
      this.vy = Math.sin(angle) * velocity - Math.random() * 5

      this.color = colors[Math.floor(Math.random() * colors.length)]
      this.size = (Math.random() * 8 + 4) * scalar
      this.life = 1
      this.rotation = Math.random() * 360
      this.rotationSpeed = Math.random() * 10 - 5
    }

    update() {
      this.vy += 0.3 // Gravity
      this.vx *= 0.98 // Air resistance
      this.vy *= 0.98

      this.x += this.vx
      this.y += this.vy
      this.rotation += this.rotationSpeed

      this.life *= decay
    }

    draw(ctx: CanvasRenderingContext2D) {
      ctx.save()
      ctx.translate(this.x, this.y)
      ctx.rotate((this.rotation * Math.PI) / 180)
      ctx.globalAlpha = this.life
      ctx.fillStyle = this.color

      // Draw rectangle (confetti piece)
      ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2)

      ctx.restore()
    }
  }

  // Create particles
  const particles: Particle[] = []
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle())
  }

  // Animation loop
  function animate() {
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    particles.forEach((particle, index) => {
      particle.update()
      particle.draw(ctx)

      // Remove dead particles
      if (particle.life < 0.01) {
        particles.splice(index, 1)
      }
    })

    if (particles.length > 0) {
      requestAnimationFrame(animate)
    } else {
      // Remove canvas when done
      canvas.remove()
    }
  }

  animate()
}

// Preset configurations
export const ConfettiPresets = {
  default: () => fireConfetti(),

  projectComplete: () => fireConfetti({
    particleCount: 100,
    spread: 90,
    startVelocity: 40,
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']
  }),

  milestone: () => fireConfetti({
    particleCount: 60,
    spread: 60,
    startVelocity: 35,
    colors: ['#fbbf24', '#f59e0b', '#f97316']
  }),

  subtle: () => fireConfetti({
    particleCount: 30,
    spread: 50,
    startVelocity: 25,
    scalar: 0.8,
    colors: ['#3b82f6', '#8b5cf6']
  })
}
