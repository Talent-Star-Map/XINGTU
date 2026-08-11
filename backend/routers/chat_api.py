"""
图图 AI 问答 API（DeepSeek）

POST /api/chat          ←→ 图图聊天接口（支持诊断上下文）
POST /api/chat/resources ←→ 根据技能列表获取学习资源

@owner: 佳豪（幻觉防控）
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import os, json, httpx
from services.learning_path import get_resources

router = APIRouter(prefix='/api', tags=['chat'])

def _get_config():
    return {
        'key': os.getenv('DEEPSEEK_API_KEY', ''),
        'model': os.getenv('DEEPSEEK_MODEL', 'deepseek-chat'),
        'base_url': os.getenv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
    }

BASE_SYSTEM_PROMPT = """你是图图，一个 AI 学习助手，专门帮助求职者提升技能、准备面试。

你的职责：
1. 回答用户关于技能学习路径的问题
2. 提供具体的学习建议和资源推荐
3. 解答技术概念问题
4. 给出求职和面试建议

回答要求：
- 简洁实用，不要空话
- 给出具体的行动建议
- 如果问题超出学习/求职范围，礼貌引导回来
- 用 emoji 让回答更生动"""


def _build_system_prompt(diagnosis: Optional[dict] = None) -> str:
    """根据诊断结果构造个性化 system prompt"""
    prompt = BASE_SYSTEM_PROMPT
    if diagnosis:
        miss_skills = diagnosis.get('miss_skills', [])
        phases = diagnosis.get('phases', [])
        if miss_skills:
            prompt += f"\n\n当前用户缺失技能：{'、'.join(miss_skills)}"
        if phases:
            prompt += f"\n当前学习阶段：{'、'.join(phases)}"
        if miss_skills or phases:
            prompt += "\n请基于用户缺失技能给出针对性学习建议，优先推荐补足缺失技能的方法。"
    return prompt


class ChatReq(BaseModel):
    message: str
    history: Optional[list] = []
    diagnosis: Optional[dict] = None


class ChatResp(BaseModel):
    answer: str


class ResourcesReq(BaseModel):
    skills: list[str]


@router.post('/chat')
async def chat(req: ChatReq):
    cfg = _get_config()
    if not cfg['key']:
        return ChatResp(answer='AI 问答服务未配置，请联系管理员。')

    # 构造消息历史
    system = _build_system_prompt(req.diagnosis)
    messages = [{'role': 'system', 'content': system}]
    for msg in (req.history or [])[-6:]:
        messages.append({'role': msg.get('role', 'user'), 'content': msg.get('text', '')})
    messages.append({'role': 'user', 'content': req.message})

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f'{cfg["base_url"]}/chat/completions',
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {cfg["key"]}',
                },
                json={
                    'model': cfg['model'],
                    'max_tokens': 1024,
                    'messages': messages,
                }
            )
            if r.status_code == 429:
                return ChatResp(answer='请求太频繁，请稍后再试。')
            if r.status_code != 200:
                return ChatResp(answer='抱歉，AI 服务暂时不可用，请稍后再试。')
            data = r.json()
            answer = data.get('choices', [{}])[0].get('message', {}).get('content', '') or '抱歉，我没有理解你的问题。'
            resp = JSONResponse(content={'answer': answer})
            resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
            resp.headers['Pragma'] = 'no-cache'
            return resp
    except Exception:
        return ChatResp(answer='网络繁忙，请稍后再试。')


@router.post('/chat/resources')
def chat_resources(req: ResourcesReq):
    """根据技能列表获取学习资源（同步 DB 调用，不用 async 避免阻塞事件循环）"""
    resources = get_resources(req.skills)
    return {'resources': resources}
