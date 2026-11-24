import { useEffect, useState } from 'react'

/** Desktop ownership comes from the installed companion extension, never from URL parameters. */
export function useDesktopCompanion() {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    let lastReply = 0
    const receive = (event: MessageEvent) => {
      if (event.source === window && event.origin === location.origin && event.data?.type === 'xingtu-desktop-state') { lastReply = Date.now(); setAvailable(event.data.available === true) }
    }
    const request = () => { if (Date.now() - lastReply > 12000) setAvailable(false); window.postMessage({ type: 'xingtu-desktop-status-request' }, location.origin) }
    window.addEventListener('message', receive)
    window.addEventListener('focus', request)
    const timer = setInterval(request, 5000)
    request()
    return () => { clearInterval(timer); window.removeEventListener('focus', request); window.removeEventListener('message', receive) }
  }, [])
  return available
}
