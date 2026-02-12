import { motion as Motion, useReducedMotion } from 'framer-motion'

export default function RevealCard({ className, children }) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <Motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
      }}
    >
      {children}
    </Motion.div>
  )
}
