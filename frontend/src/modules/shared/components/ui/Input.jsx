export default function Input({ label, error, className = '', id, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200 ${
          error ? 'border-red-400' : 'border-slate-300 focus:border-indigo-400'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
