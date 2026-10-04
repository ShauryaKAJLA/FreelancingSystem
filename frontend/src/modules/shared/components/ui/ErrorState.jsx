export default function ErrorState({ message = 'Something went wrong loading this data.' }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center text-sm text-red-700">
      {message}
    </div>
  )
}
