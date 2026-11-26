import { useEffect, useRef, useState, type RefObject } from 'react'
import { InterviewCapture } from '../../lib/interviewCapture'
import { InterviewRecognition } from '../../lib/interviewRecognition'
import { InterviewVision, type VisionState } from '../../lib/interviewVision'

type Challenge = { session_id: string; challenge_id: string; phrase: string; enrolled: boolean }
type Result = { accepted: boolean; text: string; checkpoint_required?: boolean; reason: string }
export function useInterviewMedia(preview: RefObject<HTMLVideoElement | null>, active: boolean, enabled: boolean,
  onText: (text: string) => void, onActivity: () => void, onBlocked: () => void) {
  const [camera, setCamera] = useState(false)
  const [vision, setVision] = useState<VisionState>({ ready: false, allowed: false, message: '请先检查设备。', faces: 0, phone: false })
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [enrolled, setEnrolled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const asrMode = 'browser'
  const recognition = useRef<InterviewRecognition | null>(null)
  const capture = useRef<InterviewCapture | null>(null), detector = useRef<InterviewVision | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const room = useRef(''), pending = useRef<Challenge | null>(null)
  const alive = useRef(true), generation = useRef(0), working = useRef(false), visionAllowed = useRef(false)
  const aborter = useRef<AbortController | null>(null)
  const callbacks = useRef({ onText, onActivity, onBlocked })
  callbacks.current = { onText, onActivity, onBlocked }
  const mayCapture = useRef(false)
  const sessionActive = useRef({ active, enabled })
  sessionActive.current = { active, enabled }
  mayCapture.current = camera && vision.allowed && (challenge !== null || (active && enabled && enrolled)) && !processing && !loading

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('xingtu_token') || ''}` })
  async function api(path: string, init: RequestInit = {}) {
    const response = await fetch(`/api/interview/audio/${path}`, { ...init, headers: { ...headers(), ...init.headers } })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : '声音核验服务暂不可用。')
    return data
  }
  async function newChallenge() {
    setError('')
    try {
      const value: Challenge = await api(`challenge?session_id=${encodeURIComponent(room.current)}`, { method: 'POST' })
      if (!alive.current) return
      pending.current = value; setChallenge(value)
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : '无法取得口令。') }
  }
  async function segment(blob: Blob, mine: number) {
    if (!mayCapture.current || working.current || mine !== generation.current) return
    working.current = true; setProcessing(true); capture.current?.setEnabled(false)
    const phrase = pending.current
    const ctrl = new AbortController(); aborter.current = ctrl
    const timeout = window.setTimeout(() => ctrl.abort(), 45000)
    try {
      const transcript = await recognition.current?.takeFinal() || ''
      if (!transcript) throw new Error('浏览器未识别到完整语音，请检查网络并重新回答。')
      if (mine !== generation.current || !visionAllowed.current) return
      const value: Result = await api(`verify?session_id=${encodeURIComponent(room.current)}${phrase ? `&challenge_id=${encodeURIComponent(phrase.challenge_id)}` : ''}`, { method: 'POST', body: blob, signal: ctrl.signal, headers: { 'Content-Type': 'audio/wav', 'X-Interview-Transcript': encodeURIComponent(transcript) } })
      if (!alive.current || mine !== generation.current || !visionAllowed.current || (!phrase && (!sessionActive.current.active || !sessionActive.current.enabled))) return
      if (!value.accepted) {
        setError(value.reason || '没有听清，请重试。')
        if (value.checkpoint_required || phrase) { callbacks.current.onBlocked(); await newChallenge() }
      } else if (phrase) {
        pending.current = null; setChallenge(null); setEnrolled(true); setError('')
      } else if (value.text) {
        setError(''); callbacks.current.onText(value.text)
      }
    } catch (e) {
      if (alive.current && mine === generation.current) { setError(e instanceof Error && e.name !== 'AbortError' ? e.message : '声音识别超时，请重试。'); if (phrase) await newChallenge() }
    } finally {
      clearTimeout(timeout)
      if (mine === generation.current) { working.current = false; if (alive.current) setProcessing(false) }
    }
  }
  function stop() {
    generation.current++; aborter.current?.abort(); working.current = false
    recognition.current?.dispose(); recognition.current = null
    capture.current?.dispose(); capture.current = null; detector.current?.dispose(); detector.current = null
    stream.current?.getTracks().forEach(t => t.stop()); stream.current = null
    if (room.current) void api(`session?session_id=${encodeURIComponent(room.current)}`, { method: 'DELETE', keepalive: true }).catch(() => {})
    room.current = ''; pending.current = null; visionAllowed.current = false
    setCamera(false); setChallenge(null); setEnrolled(false); setProcessing(false); setLoading(false)
    setVision({ ready: false, allowed: false, message: '请检查设备后继续。', faces: 0, phone: false })
  }
  async function prepare() {
    if (loading) return
    stop(); setLoading(true); setError('')
    const mine = generation.current
    try {
      if (!InterviewRecognition.available()) throw new Error('此浏览器不支持语音识别，请使用支持中文语音识别的 Chrome 或 Edge。')
      const config = await api('status')
      if (!config.speaker_configured) throw new Error('服务器声纹模型尚未安装，请管理员完成声音核验配置。')
      const media = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      if (!alive.current || mine !== generation.current) { media.getTracks().forEach(t => t.stop()); return }
      stream.current = media; setCamera(true)
      if (!preview.current) throw new Error('无法打开摄像头预览。')
      preview.current.srcObject = media; await preview.current.play()
      media.getVideoTracks()[0].addEventListener('ended', () => {
        visionAllowed.current = false; setCamera(false); callbacks.current.onBlocked()
        setVision({ ready: false, allowed: false, message: '摄像头已断开，请重新检查设备。', faces: 0, phone: false })
      })
      const det = new InterviewVision(value => {
        if (!alive.current || mine !== generation.current) return
        const wasAllowed = visionAllowed.current
        visionAllowed.current = value.allowed
        if (wasAllowed && !value.allowed) { capture.current?.setEnabled(false); recognition.current?.setEnabled(false); callbacks.current.onBlocked() }
        setVision(value)
      })
      detector.current = det
      await det.start(preview.current)
      if (!alive.current || mine !== generation.current) return
      const value: Challenge = await api('session', { method: 'POST' })
      if (!alive.current || mine !== generation.current) { void api(`session?session_id=${value.session_id}`, { method: 'DELETE' }).catch(() => {}); return }
      room.current = value.session_id; pending.current = value; setChallenge(value)
      const mic = new InterviewCapture(blob => { void segment(blob, mine) }, () => callbacks.current.onActivity())
      capture.current = mic
      await mic.start()
      if (mine === generation.current) {
        const asr = new InterviewRecognition(message => { setError(message); capture.current?.setEnabled(false); callbacks.current.onBlocked() })
        recognition.current = asr; asr.setTrack(mic.audioTrack)
        mic.setEnabled(mayCapture.current)
      }
    } catch (e) {
      if (alive.current && mine === generation.current) { stop(); setError(e instanceof Error ? e.message : '设备检查失败，请允许摄像头和麦克风权限。') }
    } finally { if (alive.current && mine === generation.current) setLoading(false) }
  }
  useEffect(() => {
    capture.current?.setEnabled(mayCapture.current)
    // During submission takeFinal stops gracefully, preserving the final browser transcript.
    if (!processing) recognition.current?.setEnabled(mayCapture.current)
  }, [camera, vision.allowed, active, enabled, challenge, enrolled, processing, loading])
  useEffect(() => { alive.current = true; return () => { alive.current = false; stop() } }, [])
  return { camera, vision, challenge, enrolled, loading, processing, error, asrMode, prepare, stop, newChallenge,
    allowed: camera && vision.allowed && enrolled && !challenge,
    listening: mayCapture.current && !loading,
    sessionId: room.current }
}
