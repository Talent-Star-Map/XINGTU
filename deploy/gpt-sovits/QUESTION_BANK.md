# 面试题知识库与面试房间

## 当前来源状态

核查仓库：https://github.com/liyupi/mianshiya （master）。仓库 MIT 许可针对软件；仓库文件目录不包含完整线上题库导出。未抓取面试鸭线上收费或用户内容，未宣称已导入其完整题库。

本项目先内置22道自行撰写的练习题（backend/resources/interview_questions.json），标记“星图自建练习题”，按岗位、规范技能词项检索，保留题目、考察要点、来源和审核状态。检索是词项扩展与加权排序，不宣称已部署向量检索。

有权使用的面试鸭题目 JSON 导出可通过以下命令导入（幂等按题目文本去重）：

```sh
python backend/scripts/import_interview_bank.py authorized-export.json --source "面试鸭授权导出" --license "本批题目的实际许可或授权说明"
```

支持JSON数组，或data/questions数组；题目字段title/question，解析answer/content，标签tags，岗位role，原文链接source_url。导入操作不会调用网站接口。--license用于记录说明，不代表程序自动核验授权。

## 自动准备

POST /api/interview/prepare：role、target_questions（6–8，默认7）。身份取求职者token，不接受其他user_id。服务端读取用户资料、最近简历，选取工作/项目/教育/技能字段；不把手机号、邮箱、年龄、婚育发送给面试模型。读取图谱所依赖的带来源链接岗位原文及技能标签，检索匹配题目，形成开场、项目深挖、技术情景和复盘计划。资料为空时按通用岗位练习；读取失败明确报错。

上下文暂存服务进程内存2小时、最多256个，按token归属隔离。默认单worker适用；多worker/多副本部署前需换共享缓存或配置会话路由，不能把随机落到另一worker的404当成模型失败。上下文不落库，服务重启需重新开始。

## 对话和权限

浏览器点击开始申请摄像头权限；授权后自动预览。自动播音后启动浏览器语音识别，识别到最终文本并停顿约2.6秒后发送。设备权限拒绝或识别不支持时保留文字模式。浏览器可能再次要求用户点击授权，不能绕过平台权限。

相邻轮次依据main_index推进主问题，常见澄清/提问表达通过规则保留在当前题，交由LLM回应，最后一题回答后自动生成报告。规则不是完备意图识别器，对复杂表达仍需真实面试测试。用户可随时提前结束；最多30轮防止上下文无限增长。

LLM先短评上一回答，再结合当前主问题继续交流。评论为练习建议，不是独立核实的事实或录用判断。报告中的原文引用逐字验证。

## 验证

- python backend/tests/test_interview.py：含6–8题计划、上下文隔离、澄清不推进、结束标识。
- node frontend/tests/interviewVoice.test.mjs：顺序播音、合成与播放重叠、中断取消。
- npm --prefix frontend run build
- python backend/tests/check_interview_ui.py：本地构建 + 模拟API + 虚拟摄像头/语音，自动聆听、7题报告和移动端布局。

浏览器测试不调用真实DeepSeek、不使用真实人脸或麦克风。需在部署环境验证真实资料、权限、问题相关性、女声、语音识别和播音延迟。
