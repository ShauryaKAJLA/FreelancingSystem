export default function Card({ className = '', children, ...props }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`} {...props}>
      {children}
    </div>
  )
}
