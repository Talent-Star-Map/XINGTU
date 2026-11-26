import { FaceDetector, FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision'

export type VisionState = { ready: boolean; allowed: boolean; message: string; faces: number; phone: boolean }
export class PresenceGate {
  private valid = 0
  private badFace = 0
  private badPhone = 0
  private allowed = false
  next(faces: number, phone: boolean): VisionState {
    this.badFace = faces === 1 ? 0 : this.badFace + 1
    this.badPhone = phone ? this.badPhone + 1 : 0
    this.valid = faces === 1 && !phone ? this.valid + 1 : 0
    const blocked = this.badFace >= 2 || this.badPhone >= 2
    if (blocked) this.allowed = false
    else if (this.valid >= 3) this.allowed = true
    return { ready: true, allowed: this.allowed, faces, phone,
      message: this.allowed ? '' : phone ? '检测到疑似手机，请放下手机或手中物品后继续。' : faces > 1 ? '检测到多人，请保持只有本人在画面中。' : faces === 0 ? '未检测到人脸，请回到摄像头前。' : '请保持本人正对摄像头。' }
  }
  reset() { this.valid = 0; this.badFace = 0; this.badPhone = 0; this.allowed = false }
}
export class InterviewVision {
  private face: FaceDetector | null = null
  private objects: ObjectDetector | null = null
  private timer: number | undefined
  private disposed = false
  private lastTime = -1
  private gate = new PresenceGate()
  constructor(private update: (state: VisionState) => void) {}
  async start(video: HTMLVideoElement) {
    const base = `${import.meta.env.BASE_URL}models/interview/`
    const files = await FilesetResolver.forVisionTasks(`${base}wasm`)
    this.face = await FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: `${base}face.tflite`, delegate: 'CPU' }, runningMode: 'VIDEO', minDetectionConfidence: 0.65 })
    this.objects = await ObjectDetector.createFromOptions(files, { baseOptions: { modelAssetPath: `${base}objects.tflite`, delegate: 'CPU' }, runningMode: 'VIDEO', scoreThreshold: 0.65, categoryAllowlist: ['cell phone'] })
    if (this.disposed) { this.dispose(); return }
    this.update({ ready: true, allowed: false, message: '请正对摄像头，保持画面中只有本人。', faces: 0, phone: false })
    this.timer = window.setInterval(() => {
      if (this.disposed) return
      if (video.readyState < 2 || video.paused || video.currentTime === this.lastTime) {
        this.gate.reset()
        this.update({ ready: true, allowed: false, message: '摄像头画面已暂停，请恢复摄像头。', faces: 0, phone: false }); return
      }
      this.lastTime = video.currentTime
      try {
        const now = performance.now()
        const faces = this.face!.detectForVideo(video, now).detections
        const phone = this.objects!.detectForVideo(video, now).detections.length > 0
        this.update(this.gate.next(faces.length, phone))
      } catch {
        this.gate.reset()
        this.update({ ready: false, allowed: false, message: '画面检测中断，请重新检查设备。', faces: 0, phone: false })
      }
    }, 500)
  }
  dispose() { this.disposed = true; clearInterval(this.timer); this.face?.close(); this.objects?.close(); this.face = null; this.objects = null }
}
