# 面试在线语音

后端使用 edge-tts 调用 Edge 在线语音服务，固定 zh-CN-XiaoxiaoNeural 晓晓声音，默认语速、音调和音量。不再部署 GPT-SoVITS、参考音频或 GPU 推理服务。

在后端实际使用的 Python 环境安装 backend/requirements.txt 并重启后端。需要服务器能够访问在线语音服务；不需要 API Key。状态接口仅检查依赖，不代表网络连通性。

浏览器接收完整短句 MP3 后按顺序播放，下一句合成和当前句播放重叠。保留打断取消、重播和系统语音备用。语音识别继续由浏览器处理。

检查：python backend/tests/test_interview.py；node frontend/tests/interviewVoice.test.mjs；npm --prefix frontend run build。实际联网语音及浏览器麦克风还需端到端验收。
