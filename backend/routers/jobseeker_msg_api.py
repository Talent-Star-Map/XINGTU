"""求职者端消息接口 — 与企业端 HR 的双向沟通

身份一律来自 token：`jobseeker_id` 不再接受前端传入，
会话归属校验用 `match_record.jobseeker_id == token.user_id`。

- GET  /api/jobseeker/conversations           对话列表（含未读数）
- GET  /api/jobseeker/messages/{record_id}    消息历史
- POST /api/jobseeker/messages                发送消息（sender_type=jobseeker）
- POST /api/jobseeker/messages/read           标记 HR 消息已读
- GET  /api/jobseeker/unread-total            未读徽标

@owner: 张boy（人岗匹配模块）
"""

from fastapi import APIRouter, Query, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func as sa_func

from auth_guard import require_jobseeker
from database import get_session, Job, Enterprise, MatchRecord, Message
# 库里存的是 UTC，返回前统一转北京时间，否则消息时间差 8 小时
from time_util import fmt

router = APIRouter(prefix='/api/jobseeker', tags=['jobseeker-msg'])


def _err(code: str, message: str):
    return {'success': False, 'error': {'code': code, 'message': message, 'details': {}}}


def _own_record(session, match_record_id: int, jobseeker_id: int) -> MatchRecord:
    """取会话并校验归属：不存在 404，不属于自己 403"""
    mr = session.query(MatchRecord).filter(MatchRecord.id == match_record_id).first()
    if not mr:
        raise HTTPException(404, f'会话不存在: id={match_record_id}')
    if mr.jobseeker_id != jobseeker_id:
        raise HTTPException(403, '无权访问该会话')
    return mr


@router.get('/conversations')
def get_conversations(
    me: dict = Depends(require_jobseeker),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    """求职者的对话列表 — 一条 match_record 一个会话，展示岗位/企业名与最后消息"""
    jobseeker_id = me['user_id']
    session = get_session()
    try:
        last_msg_subq = (
            session.query(
                Message.match_record_id,
                sa_func.max(Message.created_at).label('last_time'),
                sa_func.max(Message.id).label('last_msg_id'),
            )
            .group_by(Message.match_record_id)
            .subquery()
        )
        rows = (
            session.query(MatchRecord, Job, Enterprise, last_msg_subq.c.last_time, last_msg_subq.c.last_msg_id)
            .join(Job, MatchRecord.job_id == Job.id, isouter=True)
            .join(Enterprise, Job.enterprise_id == Enterprise.id, isouter=True)
            .join(last_msg_subq, MatchRecord.id == last_msg_subq.c.match_record_id, isouter=True)
            .filter(
                MatchRecord.jobseeker_id == jobseeker_id,
                MatchRecord.status == 'communicating',
            )
            .order_by(sa_func.coalesce(last_msg_subq.c.last_time, MatchRecord.updated_at).desc())
            .offset((page - 1) * size)
            .limit(size)
            .all()
        )
        total = (session.query(MatchRecord)
                 .filter(MatchRecord.jobseeker_id == jobseeker_id, MatchRecord.status == 'communicating')
                 .count())
        unread_total = (session.query(sa_func.count(Message.id))
                        .join(MatchRecord, Message.match_record_id == MatchRecord.id)
                        .filter(MatchRecord.jobseeker_id == jobseeker_id,
                                Message.sender_type == 'enterprise', Message.is_read == 0)
                        .scalar()) or 0

        conversations = []
        for mr, job, ent, last_time, last_msg_id in rows:
            company = (ent.company_name if ent else '') or ''
            last_msg = None
            if last_msg_id:
                m = session.query(Message).filter(Message.id == last_msg_id).first()
                if m:
                    last_msg = m.content[:80]
            unread = (session.query(sa_func.count(Message.id))
                      .filter(Message.match_record_id == mr.id,
                              Message.sender_type == 'enterprise', Message.is_read == 0)
                      .scalar()) or 0
            conversations.append({
                'match_record_id': mr.id,
                'job_title': job.title if job else '',
                'company': company,
                'company_av': (company or '企')[0],
                'match_score': mr.match_score,
                'last_message': last_msg or '',
                'last_time': fmt(last_time) or fmt(mr.updated_at),
                'unread_count': unread,
            })
        return {'success': True, 'data': {'conversations': conversations, 'total': total,
                                          'unread_total': unread_total, 'page': page, 'size': size},
                'message': 'ok'}
    except HTTPException:
        raise
    except Exception as e:
        return _err('CONVERSATIONS_ERROR', f'获取对话列表失败: {e}')
    finally:
        session.close()


@router.get('/messages/{match_record_id}')
def get_messages(match_record_id: int, me: dict = Depends(require_jobseeker),
                 page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=200)):
    """会话消息历史（时间正序），仅限本人会话"""
    session = get_session()
    try:
        _own_record(session, match_record_id, me['user_id'])
        total = session.query(Message).filter(Message.match_record_id == match_record_id).count()
        msgs = (session.query(Message)
                .filter(Message.match_record_id == match_record_id)
                .order_by(Message.created_at.asc())
                .offset((page - 1) * size).limit(size).all())
        return {'success': True, 'data': {'messages': [{
            'id': m.id, 'sender_type': m.sender_type, 'sender_id': m.sender_id,
            'content': m.content, 'is_read': m.is_read,
            'created_at': fmt(m.created_at, '%Y-%m-%d %H:%M:%S'),
        } for m in msgs], 'total': total, 'page': page, 'size': size}, 'message': 'ok'}
    except HTTPException:
        raise
    except Exception as e:
        return _err('GET_MESSAGES_ERROR', f'获取消息失败: {e}')
    finally:
        session.close()


class SeekerSendReq(BaseModel):
    match_record_id: int = Field(...)
    content: str = Field(..., min_length=1, max_length=2000)


@router.post('/messages')
def send_message(req: SeekerSendReq, me: dict = Depends(require_jobseeker)):
    """求职者发消息 — 发送者身份取自 token，不接受前端传 user id"""
    session = get_session()
    try:
        mr = _own_record(session, req.match_record_id, me['user_id'])
        msg = Message(match_record_id=req.match_record_id, sender_type='jobseeker',
                      sender_id=me['user_id'], content=req.content, is_read=0)
        session.add(msg)
        if mr.status == 'pending':
            mr.status = 'communicating'
        session.commit()
        session.refresh(msg)
        return {'success': True, 'data': {'id': msg.id, 'sender_type': msg.sender_type,
                                          'content': msg.content,
                                          'created_at': fmt(msg.created_at, '%Y-%m-%d %H:%M:%S')},
                'message': '消息已发送'}
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        return _err('SEND_MESSAGE_ERROR', f'发送消息失败: {e}')
    finally:
        session.close()


@router.post('/messages/read')
def mark_read(match_record_id: int = Query(...), me: dict = Depends(require_jobseeker)):
    """打开聊天框时把 HR 发来的消息标为已读（仅本人会话）"""
    session = get_session()
    try:
        _own_record(session, match_record_id, me['user_id'])
        session.query(Message).filter(
            Message.match_record_id == match_record_id,
            Message.sender_type == 'enterprise',
            Message.is_read == 0,
        ).update({'is_read': 1}, synchronize_session=False)
        session.commit()
        return {'success': True, 'data': {'match_record_id': match_record_id}, 'message': '已读'}
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        return _err('MARK_READ_ERROR', f'标记已读失败: {e}')
    finally:
        session.close()


@router.get('/unread-total')
def unread_total(me: dict = Depends(require_jobseeker)):
    """导航栏未读徽标 — 只统计 token 对应用户收到的未读 HR 消息"""
    session = get_session()
    try:
        n = (session.query(sa_func.count(Message.id))
             .join(MatchRecord, Message.match_record_id == MatchRecord.id)
             .filter(MatchRecord.jobseeker_id == me['user_id'],
                     Message.sender_type == 'enterprise', Message.is_read == 0)
             .scalar()) or 0
        return {'success': True, 'data': {'unread_total': n}, 'message': 'ok'}
    finally:
        session.close()
