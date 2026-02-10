import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          React + Tailwind
        </h1>
        <p className="mt-2 text-slate-600">
          Edit <code className="rounded bg-slate-100 px-1 py-0.5">src/App.jsx</code>{' '}
          and save to test HMR.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCount((c) => c + 1)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            Count: {count}
          </button>
          <button
            type="button"
            onClick={() => setCount(0)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
