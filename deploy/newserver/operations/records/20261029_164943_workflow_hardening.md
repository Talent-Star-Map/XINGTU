# 工作流权限、超时和重复执行防护

检查时间：2026-10-29T16:49:43.431509+08:00；记录ID：`20261029_164943_workflow_hardening`。基线：`ae774b41076a104ae552dfdaa3833b15666dc307`。

用户要求保留必要维护与安全检查，在现有流程上提高可靠性。本次只修改CI配置和维护约定，不发布应用、不重启服务、不改数据库或已交付账号/JWT/邮箱授权码/API key。

## 改动

- Credential check仍对push、pull_request的全部路径执行，保留两项原检查和固定完整SHA的checkout。
- GITHUB_TOKEN只授予contents:read，checkout设置persist-credentials:false。
- 单check任务timeout-minutes:5；concurrency按workflow/ref分组，cancel-in-progress:true，新的同ref检查替代旧运行。不同分支/PR互不取消，取消不代表通过。
- 原每日09:30本机任务保持同一ID、时间和ACTIVE；补充同次触发识别、网络瞬态最多补试一次、未修复的相同提交不反复部署、重要记录合并推送、失败门禁与实际Actions结论核对。
- 不新增Actions部署、定时CI、自提交、自重跑、AI审查或外部收费调用。文档仍经过凭据扫描，不用跳过安全检查来节省用量。

## 验证与边界

在独立检出验证YAML结构和上述限制，原凭据扫描为0发现，git diff --check通过；本机automation读回确认ID、日程、ACTIVE和补充约束。原开发工作区11处修改及.coverage保持。

推送前核对的最近10次Actions全部success、run_attempt=1；这不是本次配置的远端验收。本次提交推送后须读取对应Credential check真实结论，并将运行链接、结果和远端SHA写入云盘同ID回执。未运行/失败/成功须区分，不能把Git推送成功当作检查成功或应用部署成功。

本轮未核组织账单/预算、云账单或快照，没有改费用设置和通知订阅。5分钟限制不是组织费用硬上限；维护提示约束不是服务器全局进程锁。保持此前用户明确保留口令的决定与既有风险记录。

回退仅需撤回本次workflow与README配置改动；保留记录，不触碰应用、账号或数据备份。
