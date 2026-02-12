import { motion as Motion, useReducedMotion } from 'framer-motion'

export default function StaggerGroup({ className, children }) {
  const reduceMotion = useReducedMotion()

  if (reduceMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <Motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 1 },
        visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
      }}
    >
      {children}
    </Motion.div>
  )
}
