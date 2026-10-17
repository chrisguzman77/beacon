import { useParams } from 'react-router-dom'

export default function Site() {
  const { id } = useParams()
  return <div className="p-8 text-dim">Site {id} detail is built in the third block.</div>
}
