"""求职者端消息接口 — 与企业端 HR 的双向沟通

企业端在 routers/enterprise.py，求职者视角的镜像：
- GET  /api/jobseeker/conversations           对话列表（含未读数）
- GET  /api/jobseeker/messages/{record_id}    消息历史
- POST /api/jobseeker/messages                发送消息（sender_type=jobseeker）
- POST /api/jobseeker/messages/read           标记 HR 消息已读

@owner: 张boy（人岗匹配模块）
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from sqlalchemy import func as sa_func

from database import get_session, Job, Jobseeker, Enterprise, MatchRecord, Message
# 库里存的是 UTC，返回前统一转北京时间，否则消息时间差 8 小时
from time_util import fmt

router = APIRouter(prefix='/api/jobseeker', tags=['jobseeker-msg'])


def _err(code: str, message: str):
    return {'success': False, 'error': {'code': code, 'message': message, 'details': {}}}


def _get_record(session, match_record_id: int, jobseeker_id: int):
    """取会话记录并校验归属（防止求职者 A 读求职者 B 的会话）"""
    mr = session.query(MatchRecord).filter(MatchRecord.id == match_record_id).first()
    if not mr:
        return None, _err('MATCH_NOT_FOUND', f'会话不存在: id={match_record_id}')
    if mr.jobseeker_id != jobseeker_id:
        return None, _err('FORBIDDEN', '无权访问该会话')
    return mr, None


@router.get('/conversations')
def get_conversations(
    jobseeker_id: int = Query(..., description='求职者 ID'),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    """求职者的对话列表 — 一条 match_record 一个会话，展示岗位/企业名与最后消息"""
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
    except Exception as e:
        return _err('CONVERSATIONS_ERROR', f'获取对话列表失败: {e}')
    finally:
        session.close()


@router.get('/messages/{match_record_id}')
def get_messages(match_record_id: int, jobseeker_id: int = Query(...),
                 page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=200)):
    """会话消息历史（时间正序）"""
    session = get_session()
    try:
        mr, err = _get_record(session, match_record_id, jobseeker_id)
        if err:
            return err
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
    except Exception as e:
        return _err('GET_MESSAGES_ERROR', f'获取消息失败: {e}')
    finally:
        session.close()


class SeekerSendReq(BaseModel):
    match_record_id: int = Field(...)
    jobseeker_id: int = Field(...)
    content: str = Field(..., min_length=1, max_length=2000)


@router.post('/messages')
def send_message(req: SeekerSendReq):
    """求职者发消息 — 路由必须是 /messages（不能带 {id} 段，否则会抢走 /messages/read 导致标已读 422）"""
    session = get_session()
    try:
        mr, err = _get_record(session, req.match_record_id, req.jobseeker_id)
        if err:
            return err
        msg = Message(match_record_id=req.match_record_id, sender_type='jobseeker',
                      sender_id=req.jobseeker_id, content=req.content, is_read=0)
        session.add(msg)
        if mr.status == 'pending':
            mr.status = 'communicating'
        session.commit()
        session.refresh(msg)
        return {'success': True, 'data': {'id': msg.id, 'sender_type': msg.sender_type,
                                          'content': msg.content,
                                          'created_at': fmt(msg.created_at, '%Y-%m-%d %H:%M:%S')},
                'message': '消息已发送'}
    except Exception as e:
        session.rollback()
        return _err('SEND_MESSAGE_ERROR', f'发送消息失败: {e}')
    finally:
        session.close()


@router.post('/messages/read')
def mark_read(match_record_id: int = Query(...), jobseeker_id: int = Query(...)):
    """打开聊天框时把 HR 发来的消息标为已读"""
    session = get_session()
    try:
        mr, err = _get_record(session, match_record_id, jobseeker_id)
        if err:
            return err
        session.query(Message).filter(
            Message.match_record_id == match_record_id,
            Message.sender_type == 'enterprise',
            Message.is_read == 0,
        ).update({'is_read': 1}, synchronize_session=False)
        session.commit()
        return {'success': True, 'data': {'match_record_id': match_record_id}, 'message': '已读'}
    except Exception as e:
        session.rollback()
        return _err('MARK_READ_ERROR', f'标记已读失败: {e}')
    finally:
        session.close()


@router.get('/unread-total')
def unread_total(jobseeker_id: int = Query(...)):
    """导航栏未读徽标 — 求职者收到的未读 HR 消息数"""
    session = get_session()
    try:
        n = (session.query(sa_func.count(Message.id))
             .join(MatchRecord, Message.match_record_id == MatchRecord.id)
             .filter(MatchRecord.jobseeker_id == jobseeker_id,
                     Message.sender_type == 'enterprise', Message.is_read == 0)
             .scalar()) or 0
        return {'success': True, 'data': {'unread_total': n}, 'message': 'ok'}
    finally:
        session.close()
