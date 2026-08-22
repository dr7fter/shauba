import { useEffect, useState } from 'react'
import { imageDataUrl } from '../api'

export function QuestionImages({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    void Promise.all(paths.map(imageDataUrl)).then(setUrls)
  }, [paths])
  return (
    <div className="question-images">
      {urls.map((url, i) => (
        <img key={paths[i]} src={url} alt={`题目附图 ${i + 1}`} />
      ))}
    </div>
  )
}
