import { useMemo } from 'react'

// UGA-themed SVG elements rendered as faint floating shapes
const PawPrint = () => (
  <svg viewBox="0 0 60 60" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="30" cy="40" rx="14" ry="12" />
    <ellipse cx="12" cy="22" rx="7" ry="9" transform="rotate(-20 12 22)" />
    <ellipse cx="23" cy="14" rx="7" ry="9" transform="rotate(-8 23 14)" />
    <ellipse cx="37" cy="14" rx="7" ry="9" transform="rotate(8 37 14)" />
    <ellipse cx="48" cy="22" rx="7" ry="9" transform="rotate(20 48 22)" />
  </svg>
)

const UgaG = () => (
  <svg viewBox="0 0 60 60" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle"
      fontSize="52" fontWeight="900" fontFamily="Georgia, serif">G</text>
  </svg>
)

const Heart = () => (
  <svg viewBox="0 0 60 60" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M30 52 L6 28 C2 22 2 12 10 8 C18 4 26 10 30 16 C34 10 42 4 50 8 C58 12 58 22 54 28 Z" />
  </svg>
)

const Football = () => (
  <svg viewBox="0 0 70 40" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="35" cy="20" rx="32" ry="17" />
    <line x1="5" y1="20" x2="65" y2="20" stroke="white" strokeWidth="2" opacity="0.4" />
    <line x1="28" y1="8" x2="28" y2="32" stroke="white" strokeWidth="1.5" opacity="0.4" />
    <line x1="35" y1="5" x2="35" y2="35" stroke="white" strokeWidth="1.5" opacity="0.4" />
    <line x1="42" y1="8" x2="42" y2="32" stroke="white" strokeWidth="1.5" opacity="0.4" />
  </svg>
)

const Bulldog = () => (
  <svg viewBox="0 0 60 60" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    {/* Simplified bulldog face silhouette */}
    <ellipse cx="30" cy="30" rx="24" ry="22" />
    <ellipse cx="30" cy="42" rx="18" ry="8" />
    <ellipse cx="18" cy="28" rx="7" ry="8" />
    <ellipse cx="42" cy="28" rx="7" ry="8" />
    <circle cx="22" cy="24" r="4" fill="white" opacity="0.3" />
    <circle cx="38" cy="24" r="4" fill="white" opacity="0.3" />
  </svg>
)

const SHAPES = [PawPrint, PawPrint, PawPrint, UgaG, UgaG, Heart, Heart, Football, Bulldog, PawPrint]

// Deterministic "random" using seeded values so it's stable across renders
function seededVal(seed, min, max) {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return min + ((x - Math.floor(x)) * (max - min))
}

export default function FloatingBackground() {
  const elements = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => {
      const Shape = SHAPES[i % SHAPES.length]
      return {
        id: i,
        Shape,
        x: seededVal(i * 3 + 1, 2, 94),
        y: seededVal(i * 3 + 2, 2, 92),
        size: seededVal(i * 3 + 3, 18, 42),
        duration: seededVal(i * 7 + 1, 22, 45),
        delay: seededVal(i * 7 + 2, -28, 0),
        rotate: seededVal(i * 7 + 3, -30, 30),
        opacity: seededVal(i * 7 + 4, 0.030, 0.065),
      }
    })
  }, [])

  return (
    <div className="floating-bg" aria-hidden="true">
      {elements.map(({ id, Shape, x, y, size, duration, delay, rotate, opacity }) => (
        <div
          key={id}
          className="floating-el"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: size,
            height: size,
            opacity,
            color: 'var(--uga-red)',
            animationDuration: `${duration}s`,
            animationDelay: `${delay}s`,
            transform: `rotate(${rotate}deg)`,
          }}
        >
          <Shape />
        </div>
      ))}
    </div>
  )
}
