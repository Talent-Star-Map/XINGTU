# 星图模拟面试语音服务接入

GPT-SoVITS 为独立推理进程，通过内部 HTTP 接口连接星图。不是把模型权重装进 FastAPI，也没有随开源仓库附赠可直接调用的公共 API。

官方项目：https://github.com/RVC-Boss/GPT-SoVITS
官方接口：https://github.com/RVC-Boss/GPT-SoVITS/blob/main/api_v2.py

## 部署顺序

1. 在推理服务器按上游 README 完成与硬件匹配的依赖、模型权重和推理配置安装。建议独立 Python 环境；不要覆盖星图后端环境。GPU、CUDA和模型版本必须匹配，CPU部署的速度需要实测。
2. 使用有授权的中文参考声音，并保存对应逐字文本。声音可与视频不同；不要未经授权克隆 HeyGen 配音演员声音。
3. 在 GPT-SoVITS 项目目录启动官方接口：

```sh
python api_v2.py -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml
```

4. 在星图后端的私有环境配置中设置：

```dotenv
INTERVIEW_TTS_URL=http://127.0.0.1:9880
INTERVIEW_TTS_REF_AUDIO=/absolute/path/on/tts-server/reference.wav
INTERVIEW_TTS_PROMPT_TEXT=参考音频中逐字对应的中文内容
INTERVIEW_TTS_PROMPT_LANG=zh
```

参考路径属于推理服务器，不属于浏览器或星图代码目录。跨机部署用内部网络地址，Docker 容器中的 127.0.0.1 指向容器自身。不要直接把含模型切换、服务控制功能的上游接口公开到互联网；需要外网连接时通过仅开放 /tts 的鉴权网关，网关 Bearer 令牌配置在 INTERVIEW_TTS_TOKEN。

5. 重启星图后端。登录求职者后，GET /api/interview/voice/status 可检查配置存在性（不是连通性）。实际播放用于连通性验收。

## 工作流

浏览器语音识别/文字输入 → DeepSeek（复用 STRONG 配置）流式回复 → 后端按完整句发出 sentence 事件 → 前端向受保护的 /api/interview/speech 发起短句合成 → 后端调用 GPT-SoVITS /tts → 返回完整短句 WAV → Web Audio 顺序播放。

视频在面试阶段全程静音循环；语音单独播放。不做精确口型同步，不再依赖原视频开场音频。

本版本采用句级流水线，不把上游 streaming_mode=true 的连续 WAV 字节直接交给浏览器，避免浏览器封装兼容性问题。下一句的合成与上一句的播放重叠；同一客户端的合成请求串行，避免无谓争抢 GPU。用户开始语音输入/停止朗读/离开页面时取消合成请求并清空待播队列。请求中断后，上游推理计算是否立即停止取决于上游实现。

自由交流上限30轮，可随时结束生成报告。原五题 /question 接口保留兼容旧客户端。语音合成失败明确提示，可重播或手动选择系统语音备用；不会冒充已成功运行 GPT-SoVITS。

## 延迟验收

页面显示首字耗时（后端收到请求到模型首文本）、首段声音耗时（前端发起本轮到开始播放）。两者测量起点不同，不宜直接相减。记录冷启动、预热后至少20轮的P50/P95、不同回答长度及并发场景，不能凭开源项目宣传值承诺延迟。

在每次加载模型后用短句预热；保持模型常驻；控制每轮回复长度；选择适合硬件的模型/精度。模型参数、流式模式与性能请对照实际安装版本的官方文档。当前未启用 GPT token 级音频流，需要进一步做浏览器 PCM 播放和具体模型兼容测试后才能启用。

生产网关对 /api/interview/conversation 关闭响应缓冲，支持90秒以内的长连接；其响应格式为 application/x-ndjson。POST /api/interview/speech 返回 audio/wav，禁止缓存。摄像头仅本地预览，语音识别仍是浏览器识别服务（GPT-SoVITS 是语音合成，不负责识别）。

## 本地检查

```sh
python backend/tests/test_interview.py
node frontend/tests/interviewVoice.test.mjs
npm --prefix frontend run build
```

这些是离线逻辑和构建检查，不替代实际服务器、真实DeepSeek与GPT-SoVITS的端到端声音验收。
