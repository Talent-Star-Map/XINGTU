# PC 模拟面试：无 GPU 语音与画面检测

## 当前采用方案（2026-11-26 用户确认）

转写继续使用浏览器 `SpeechRecognition / webkitSpeechRecognition`，无需在服务器安装 ASR 模型或开通语音 API。默认 `INTERVIEW_ASR_MODE=browser`；服务器只需 CAM++ 声纹模型。下面的 CPU/API 识别选项为实验备选，不是当前默认功能。

浏览器支持 `SpeechRecognition.start(audioTrack)` 时传入 RNNoise 输出音轨；旧版实现回退浏览器麦克风识别，不能保证 RNNoise 直接作用于其转写输入。但所有提交仍受 RNNoise 有效声音门槛与声纹比对约束，临时转写片段不打断数字人。浏览器识别可能使用浏览器厂商在线服务，需网络与用户授权。

对应录音调用 `/api/interview/audio/verify`，服务器只计算声音相似度；随机口令文字由浏览器提供，明确标记 `browser_unverified`，不是服务器独立验证的录音转写凭据，不构成强身份或防作弊认证。视频不上传，录音不落盘，声纹仅本次会话保存。

## 安装与发布

在现有后端虚拟环境（推荐 Python 3.10–3.13）执行：

```sh
pip install -r backend/requirements-interview.txt
python backend/scripts/setup_interview_models.py
cd frontend
npm ci
npm run build
```

默认模型脚本仅下载 MediaPipe 人脸检测、SSD MobileNet V2 物体检测与 CAM++ 声纹，不下载 SenseVoice；只有显式传入 `--include-local-asr` 才下载该实验识别模型。前端模型必须随静态目录发布；WASM 由构建命令从固定 npm 依赖复制，不依赖运行时 CDN。首次声纹模型加载有额外耗时，可在服务启动后的内部健康预热中调用 `services.interview_audio.models(speaker_only=True)`。

当前会话与声纹采用进程内临时保存，与既有面试上下文一致。该服务应运行单个 API worker；若扩展多个 worker/实例，需要先使用共享会话存储及路由粘性。不要仅增加 worker 后直接上线。

## 识别通道

当前默认 `INTERVIEW_ASR_MODE=browser`。只有实验配置 `cpu` 才使用 SenseVoice；CAM++ 使用 CPU，默认 1 线程、并发 1 个任务，服务忙时返回 429，前端提示重试。

可配置 OpenAI-compatible **音频转写** API（普通聊天 API 不一定支持）：

API 部署可以运行 `python backend/scripts/setup_interview_models.py --speaker-only`，只下载前端检测模型与约 28.3 MB 的 CAM++，跳过约 239.2 MB 的 SenseVoice int8。`--vision-only` 不下载任何后端声音模型。注意：当前 HTTP API 适配器不是阿里云/火山的实时 WebSocket 协议，开通这些产品后需相应适配，不能只替换 URL。

```dotenv
INTERVIEW_ASR_MODE=api
INTERVIEW_ASR_URL=https://YOUR_PROVIDER/v1/audio/transcriptions
INTERVIEW_ASR_API_KEY=YOUR_KEY
INTERVIEW_ASR_MODEL=YOUR_TRANSCRIPTION_MODEL
INTERVIEW_AUDIO_THREADS=1
INTERVIEW_SPEAKER_THRESHOLD=0.55
```

API 模式仍在 CPU 本地做 CAM++ 声音比对，不再加载 SenseVoice；不静默切换服务商。API 模式会将分段录音交给配置的服务商，界面会提示。上线前核对服务商的数据保留政策及价格。声纹阈值 0.55 为可调初值，应使用本人/他人、不同设备与噪音样本校准，不能把相似度解释为身份真实性概率。

## 行为

- 浏览器：WebRTC 回声消除 + RNNoise WASM；持续约 400ms 的信号才启动录制，停顿约 1.1 秒分段。浏览器识别只提交最终结果，录音仅发送声纹比对，不调用服务器转写。
- 只有转写成功且声音比对通过的有效文字，才能打断面试官；短暂杂音、短识别词和明显播音回声不触发打断。回答与 TTS 的回声消除仍建议佩戴耳机。
- 不播音时隐藏说话视频，展示从原视频提取的闭嘴静帧；播音时播放原视频。这不是逐字口型驱动。
- MediaPipe CPU 每 500ms 检测人脸与疑似手机，连续异常 2 帧暂停，连续正常 3 帧恢复。没有人脸、多人、画面暂停、检测失败时不能继续；手机提示仅针对模型能识别的可见手机，不声称检测任意物品或画面外设备。
- 随机口令的浏览器转写按顺序核对，口令 90 秒过期且仅允许一次尝试；声音每个回答片段比对，超过 3 分钟需要新口令复核。客户端转写不提供强真实性保证。
- 原始摄像头视频不上传；录音在内存处理，不落盘；声纹仅本次会话使用，退出/结束删除，最长 2 小时过期。服务器进程重启会要求重新录入。
- CAM++ 是说话人相似度模型，**不具备保证识别高质量克隆声音的能力**。随机口令降低预录重放风险，但不能保证阻止实时克隆。声音差异与画面异常是练习提醒，不纳入能力评分或招聘决策。

## 验证

```sh
python backend/tests/test_interview_audio.py
node frontend/tests/interviewVoice.test.mjs
node frontend/tests/interviewMedia.test.mjs
node frontend/tests/interviewRecognition.test.mjs
npm --prefix frontend run build
```

CPU 模型本地初测：Windows 开发机，单线程，8 秒原数字人中文录音，模型冷加载约 1.57s；3 次热运行 ASR 0.406–0.431s、CAM++ 0.088–0.098s。不含网络、分段停顿、LLM 与 TTS，不代表云服务器多人并发结果。云服务器上线前需实测同机的端到端 P50/P95 和 1/2/4 用户并发。

已执行浏览器组合验证：真实 CPU 模型检测单个人脸/空画面、真实中文录音经 RNNoise 分段、声音录入后许可面试、离开画面暂停、回到画面恢复，页面无未捕获异常。可在本地 Vite 服务运行后使用 `backend/tests/check_interview_media_browser.py` 重跑（需要 Playwright、ffmpeg 与模型资产；可设置 `INTERVIEW_TEST_ORIGIN` 和 `CHROMIUM_PATH`）。手机、多人与防抖状态机已回归；手机模型在真实用户摄像头中的检出率及声纹误拒率仍需实机标定。

## 上游

- https://github.com/sapphi-red/web-noise-suppressor （MIT）
- https://github.com/xiph/rnnoise （BSD-3-Clause，包内提供 WASM）
- https://github.com/google-ai-edge/mediapipe （Apache-2.0；另核对模型卡）
- https://github.com/k2-fsa/sherpa-onnx （Apache-2.0；模型来源记录于安装脚本）
- https://github.com/modelscope/3D-Speaker （Apache-2.0）

## 轻量模型选型补测（2026-11-26）

Vosk 中文小模型官方包 43,898,754 bytes，解压后 68,292,271 bytes。本机 Windows 对同一段原数字人旁白各运行 8 次：3 秒录音 P50 912ms、8 秒 1609ms、16 秒 2239ms。8 秒示例把“AI 面试官”识别为“哎呀面试官”；16 秒还出现“项目经历→项目经理”等误识别。这是有限语料对照，不是通用准确率结论。体积较小但在本次样本上速度与中英混合识别不占优势，因此没有加入生产依赖，也没有替换现有实现。

推荐候选：阿里云 Fun-ASR-Realtime 或火山引擎双向实时 ASR，按服务商真实账号、地域与网络测试后选择。暂未开通 API 账号，未测试其实际延迟/识别率，不宣称某一家更快。官方资料：

- https://alphacephei.com/vosk/models
- https://help.aliyun.com/zh/model-studio/fun-asr-realtime-websocket-api
- https://docs.volcengine.com/docs/ark/agent-plan-enterprise-voice-model?lang=en
