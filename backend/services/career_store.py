"""Private career-assistant persistence. Tables are installed explicitly by SQL.

No model-supplied identity is accepted: callers supply an authenticated owner.
The default store never creates tables or falls back to process-local memory.
"""
from __future__ import annotations

import hashlib
import json
import re
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError


class CareerStoreError(ValueError):
    pass


def _owner(value):
    if not isinstance(value, str) or not re.fullmatch(r'jobseeker:[1-9]\d*', value):
        raise CareerStoreError('需要有效的求职者身份')
    return value


def _dump(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _row(row):
    if row is None:
        return None
    data = dict(row)
    for key in ('metadata', 'source', 'evidence', 'value', 'payload', 'job_snapshot', 'provenance'):
        if key in data and isinstance(data[key], str):
            try:
                data[key] = json.loads(data[key])
            except (ValueError, TypeError):
                pass
    for key in ('confirmed',):
        if key in data:
            data[key] = bool(data[key])
    for key in ('created_at', 'updated_at'):
        if isinstance(data.get(key), datetime):
            data[key] = data[key].isoformat() + 'Z'
    return data


class CareerStore:
    def __init__(self, session_factory=None):
        if session_factory is None:
            from database import get_session
            session_factory = get_session
        self.session_factory = session_factory

    @contextmanager
    def _session(self, existing=None):
        if existing is not None:
            yield existing
            return
        session = self.session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def _thread(self, s, owner, thread_id):
        row = s.execute(text('SELECT * FROM career_threads WHERE owner=:owner AND id=:id'),
                        {'owner': _owner(owner), 'id': thread_id}).mappings().first()
        if not row:
            raise CareerStoreError('会话不存在')
        return _row(row)

    def create_thread(self, owner):
        owner = _owner(owner)
        data = dict(id=uuid.uuid4().hex, owner=owner, title='与小星的对话', metadata='{}',
                    created_at=_now(), updated_at=_now())
        with self._session() as s:
            s.execute(text('INSERT INTO career_threads (id,owner,title,metadata,created_at,updated_at) '
                           'VALUES (:id,:owner,:title,:metadata,:created_at,:updated_at)'), data)
        return _row(data)

    def list_threads(self, owner):
        with self._session() as s:
            return [_row(r) for r in s.execute(text('SELECT * FROM career_threads WHERE owner=:owner '
                                                   'ORDER BY updated_at DESC,id DESC LIMIT 100'),
                                               {'owner': _owner(owner)}).mappings()]

    def get_thread(self, owner, thread_id):
        with self._session() as s:
            return self._thread(s, owner, thread_id)

    def update_thread(self, owner, thread_id, metadata):
        if not isinstance(metadata, dict) or len(_dump(metadata)) > 50000:
            raise CareerStoreError('会话上下文过大或格式错误')
        with self._session() as s:
            current = self._thread(s, owner, thread_id)
            # Caller supplies a merged snapshot. Identity is never read from metadata.
            s.execute(text('UPDATE career_threads SET metadata=:metadata,updated_at=:now '
                           'WHERE owner=:owner AND id=:id'),
                      {'metadata': _dump(metadata), 'now': _now(), 'owner': owner, 'id': thread_id})
            current['metadata'] = metadata
            return current

    def messages(self, owner, thread_id):
        with self._session() as s:
            self._thread(s, owner, thread_id)
            return [_row(r) for r in s.execute(text('SELECT * FROM career_messages WHERE owner=:owner '
                                                   'AND thread_id=:tid ORDER BY created_at,id LIMIT 500'),
                                               {'owner': owner, 'tid': thread_id}).mappings()]

    def append_message(self, owner, thread_id, role, content, metadata=None):
        if role not in ('user', 'assistant') or not isinstance(content, str) or not content.strip() or len(content) > 50000:
            raise CareerStoreError('消息格式错误')
        if metadata is not None and not isinstance(metadata, dict):
            raise CareerStoreError('消息元数据格式错误')
        data = dict(id=uuid.uuid4().hex, owner=_owner(owner), thread_id=thread_id, role=role,
                    content=content, metadata=_dump(metadata or {}), created_at=_now())
        with self._session() as s:
            self._thread(s, owner, thread_id)
            s.execute(text('INSERT INTO career_messages (id,owner,thread_id,role,content,metadata,created_at) '
                           'VALUES (:id,:owner,:thread_id,:role,:content,:metadata,:created_at)'), data)
            s.execute(text('UPDATE career_threads SET updated_at=:now WHERE owner=:owner AND id=:id'),
                      {'now': _now(), 'owner': owner, 'id': thread_id})
            if role=='user':
                s.execute(text("UPDATE career_threads SET title=:title WHERE owner=:owner AND id=:id AND title='与小星的对话'"),
                          {'title':content.strip()[:28],'owner':owner,'id':thread_id})
        return _row(data)

    def list_facts(self, owner):
        with self._session() as s:
            return [_row(r) for r in s.execute(text("SELECT * FROM career_facts WHERE owner=:owner "
                                                   "AND status!='retracted' ORDER BY updated_at DESC,id DESC LIMIT 500"),
                                               {'owner': _owner(owner)}).mappings()]

    def upsert_fact(self, owner, kind, key, value, source, evidence, confirmed=False):
        owner = _owner(owner)
        if not isinstance(source, dict):
            source = {'type': str(source)}
        source_type = str(source.get('type') or source.get('kind') or '')
        if source_type not in ('user', 'user_message', 'user_confirmation', 'profile', 'account', 'resume', 'github', 'skill_mark'):
            raise CareerStoreError('该来源不能作为用户事实')
        if not kind or not key or len(kind) > 50 or len(key) > 200 or value in (None, '', [], {}):
            raise CareerStoreError('事实内容不能为空')
        if not evidence or len(_dump(value)) > 30000 or len(_dump(evidence)) > 50000:
            raise CareerStoreError('事实需要原始依据，且内容不能过大')
        source_key = hashlib.sha256(_dump(source).encode()).hexdigest()
        with self._session() as s:
            existing = s.execute(text('SELECT * FROM career_facts WHERE owner=:owner AND kind=:kind '
                                      'AND fact_key=:key AND source_key=:source_key'),
                                 {'owner': owner, 'kind': kind, 'key': key, 'source_key': source_key}).mappings().first()
            peers = s.execute(text("SELECT value FROM career_facts WHERE owner=:owner AND kind=:kind "
                                   "AND fact_key=:key AND status!='retracted'"),
                              {'owner': owner, 'kind': kind, 'key': key}).mappings().all()
            conflict = any(_row(p)['value'] != value for p in peers)
            if existing and bool(existing['confirmed']) and _row(existing)['value'] != value:
                # A stale source refresh must not overwrite a user's explicit correction.
                result = _row(existing)
                result.update(requires_confirmation=True, proposed_value=value)
                return result
            if existing and existing['status']=='retracted':
                # Forgetting a source must survive automatic material refreshes.
                return _row(existing)
            data = dict(id=existing['id'] if existing else uuid.uuid4().hex, owner=owner, kind=kind,
                        key=key, value=_dump(value), source=_dump(source), source_key=source_key,
                        evidence=_dump(evidence), confirmed=int(bool(confirmed) or bool(existing and existing['confirmed'])),
                        status='conflict' if conflict else ('active' if confirmed or (existing and existing['confirmed']) else 'candidate'), now=_now())
            if existing:
                s.execute(text('UPDATE career_facts SET value=:value,source=:source,evidence=:evidence,'
                               'confirmed=:confirmed,status=:status,updated_at=:now WHERE owner=:owner AND id=:id'), data)
            else:
                s.execute(text('INSERT INTO career_facts (id,owner,kind,fact_key,value,source,source_key,evidence,confirmed,status,created_at,updated_at) '
                               'VALUES (:id,:owner,:kind,:key,:value,:source,:source_key,:evidence,:confirmed,:status,:now,:now)'), data)
            row = s.execute(text('SELECT * FROM career_facts WHERE owner=:owner AND id=:id'), data).mappings().first()
            result = _row(row)
            result['requires_confirmation'] = conflict or not result['confirmed']
            return result

    def confirm_fact(self, owner, fact_id, value=None):
        with self._session() as s:
            row = s.execute(text("SELECT * FROM career_facts WHERE owner=:owner AND id=:id AND status!='retracted'"),
                            {'owner': _owner(owner), 'id': fact_id}).mappings().first()
            if not row:
                raise CareerStoreError('资料不存在')
            current = _row(row)
            if value is not None:
                if value in ('', [], {}) or len(_dump(value)) > 30000:
                    raise CareerStoreError('确认内容不能为空或过大')
                current['value'] = value
            if current['kind'] in ('skill','preference') and (not isinstance(current['value'],str) or len(current['value'])>500):
                raise CareerStoreError('技能和偏好请填写简短文字')
            if current['kind'] in ('project','work','education') and not isinstance(current['value'],(str,dict)):
                raise CareerStoreError('经历资料格式不正确')
            if current.get('source',{}).get('type')=='github':
                project=current['value']
                if not isinstance(project,dict) or not str(project.get('description') or '').strip():
                    raise CareerStoreError('请先补充你本人负责的模块或真实成果，再确认仓库项目')
            # Confirming one value explicitly supersedes conflicting active values.
            s.execute(text("UPDATE career_facts SET status='retracted',updated_at=:now WHERE owner=:owner "
                           'AND kind=:kind AND fact_key=:key AND id!=:id'),
                      {'now': _now(), 'owner': owner, 'kind': current['kind'], 'key': current['fact_key'], 'id': fact_id})
            s.execute(text("UPDATE career_facts SET value=:value,confirmed=1,status='active',updated_at=:now "
                           'WHERE owner=:owner AND id=:id'),
                      {'value': _dump(current['value']), 'now': _now(), 'owner': owner, 'id': fact_id})
            current.update(confirmed=True, status='active')
            return current

    def delete_fact(self, owner, fact_id):
        with self._session() as s:
            result = s.execute(text("UPDATE career_facts SET status='retracted',updated_at=:now WHERE owner=:owner AND id=:id"),
                               {'now': _now(), 'owner': _owner(owner), 'id': fact_id})
            if result.rowcount != 1:
                raise CareerStoreError('资料不存在')

    def invalidate_source(self, owner, source):
        """Called by source-deletion adapters; prevents removed evidence being reused."""
        source_key = hashlib.sha256(_dump(source).encode()).hexdigest()
        with self._session() as s:
            return s.execute(text("UPDATE career_facts SET status='retracted',updated_at=:now "
                                  'WHERE owner=:owner AND source_key=:source_key'),
                             {'owner': _owner(owner), 'source_key': source_key, 'now': _now()}).rowcount

    def delete_thread(self, owner, thread_id):
        with self._session() as s:
            self._thread(s, owner, thread_id)
            # Keep generated resumes, but remove chat-derived memories and private messages.
            rows = s.execute(text('SELECT id,source FROM career_facts WHERE owner=:owner'), {'owner': owner}).mappings()
            for row in rows:
                source = _row(row)['source']
                if isinstance(source, dict) and source.get('thread_id') == thread_id:
                    s.execute(text("UPDATE career_facts SET status='retracted',updated_at=:now WHERE owner=:owner AND id=:id"),
                              {'now': _now(), 'owner': owner, 'id': row['id']})
            s.execute(text('DELETE FROM career_messages WHERE owner=:owner AND thread_id=:id'), {'owner': owner, 'id': thread_id})
            s.execute(text('DELETE FROM career_runs WHERE owner=:owner AND thread_id=:id'), {'owner':owner,'id':thread_id})
            s.execute(text('DELETE FROM career_threads WHERE owner=:owner AND id=:id'), {'owner': owner, 'id': thread_id})

    def create_run(self, owner, thread_id, job_key, idempotency_key, payload=None):
        owner = _owner(owner)
        if not idempotency_key or len(idempotency_key) > 160:
            raise CareerStoreError('请求标识无效')
        data = dict(id=uuid.uuid4().hex, owner=owner, thread_id=thread_id, job_key=str(job_key),
                    idempotency_key=idempotency_key, status='pending', payload=_dump(payload or {}), now=_now())
        try:
            with self._session() as s:
                self._thread(s, owner, thread_id)
                existing = s.execute(text('SELECT * FROM career_runs WHERE owner=:owner AND idempotency_key=:idempotency_key'), data).mappings().first()
                if existing:
                    result = _row(existing)
                    if result['thread_id'] != thread_id or result['job_key'] != str(job_key):
                        raise CareerStoreError('请求标识已用于其他任务')
                    return {**result, 'created': False}
                s.execute(text('INSERT INTO career_runs (id,owner,thread_id,job_key,idempotency_key,status,payload,created_at,updated_at) '
                               'VALUES (:id,:owner,:thread_id,:job_key,:idempotency_key,:status,:payload,:now,:now)'), data)
        except IntegrityError:
            with self._session() as s:
                existing = s.execute(text('SELECT * FROM career_runs WHERE owner=:owner AND idempotency_key=:idempotency_key'), data).mappings().first()
                if not existing or existing['thread_id'] != thread_id or existing['job_key'] != str(job_key):
                    raise CareerStoreError('请求标识冲突') from None
                return {**_row(existing), 'created': False}
        return {**self.get_run(owner, data['id']), 'created': True}

    def get_run(self, owner, run_id):
        with self._session() as s:
            row = s.execute(text('SELECT * FROM career_runs WHERE owner=:owner AND id=:id'),
                            {'owner': _owner(owner), 'id': run_id}).mappings().first()
            if not row:
                raise CareerStoreError('任务不存在')
            return _row(row)

    def update_run(self, owner, run_id, status, payload=None, session=None):
        allowed = {'pending', 'running', 'needs_input', 'awaiting_confirmation', 'reviewing', 'ready', 'completed', 'failed', 'cancelled'}
        if status not in allowed or (payload is not None and not isinstance(payload, dict)):
            raise CareerStoreError('任务状态无效')
        with self._session(session) as s:
            fields = 'status=:status,updated_at=:now' + (',payload=:payload' if payload is not None else '')
            result = s.execute(text(f'UPDATE career_runs SET {fields} WHERE owner=:owner AND id=:id'),
                               {'status': status, 'now': _now(), 'payload': _dump(payload), 'owner': _owner(owner), 'id': run_id})
            if result.rowcount != 1:
                raise CareerStoreError('任务不存在')

    def claim_run(self, owner, run_id, expected_status='pending'):
        with self._session() as s:
            return s.execute(text("UPDATE career_runs SET status='running',updated_at=:now WHERE owner=:owner "
                                  'AND id=:id AND status=:expected'),
                             {'owner': _owner(owner), 'id': run_id, 'expected': expected_status, 'now': _now()}).rowcount == 1

    def acquire_thread_run(self, owner, thread_id, run_id):
        """Only one business task mutates a conversation at a time, across workers."""
        with self._session() as s:
            self._thread(s, owner, thread_id)
            return s.execute(text('UPDATE career_threads SET active_run_id=:rid WHERE owner=:owner AND id=:tid '
                                  'AND (active_run_id IS NULL OR active_run_id=:rid)'),
                             {'owner': owner, 'tid': thread_id, 'rid': run_id}).rowcount == 1

    def release_thread_run(self, owner, thread_id, run_id):
        with self._session() as s:
            s.execute(text('UPDATE career_threads SET active_run_id=NULL WHERE owner=:owner AND id=:tid AND active_run_id=:rid'),
                      {'owner': _owner(owner), 'tid': thread_id, 'rid': run_id})

    def latest_run(self, owner, thread_id):
        with self._session() as s:
            self._thread(s,owner,thread_id)
            return _row(s.execute(text('SELECT * FROM career_runs WHERE owner=:owner AND thread_id=:tid '
                                       'ORDER BY created_at DESC,id DESC LIMIT 1'), {'owner':owner,'tid':thread_id}).mappings().first())

    def recover_run(self,owner,run_id):
        """Recover after process death; never duplicate a committed resume."""
        from datetime import timedelta
        with self._session() as s:
            run=_row(s.execute(text('SELECT * FROM career_runs WHERE owner=:owner AND id=:id'),
                               {'owner':_owner(owner),'id':run_id}).mappings().first())
            if not run:raise CareerStoreError('任务不存在')
            if run['status']=='ready':
                result=run['payload'].get('resume')
                if result:
                    payload={**run['payload'],'events':[{'event':'resume_ready',**result}]}
                    s.execute(text("UPDATE career_runs SET status='completed',payload=:payload WHERE owner=:owner AND id=:id"),
                              {'owner':owner,'id':run_id,'payload':_dump(payload)})
                    s.execute(text('UPDATE career_threads SET active_run_id=NULL WHERE owner=:owner AND active_run_id=:id'),{'owner':owner,'id':run_id})
                    return 'completed'
            stamp=run.get('updated_at')
            stamp=datetime.fromisoformat(stamp.replace('Z','')) if isinstance(stamp,str) else stamp
            if run['status'] in ('running','reviewing') and stamp and stamp<_now()-timedelta(seconds=300):
                changed=s.execute(text("UPDATE career_runs SET status='pending',updated_at=:now WHERE owner=:owner AND id=:id AND updated_at=:stamp"),
                                  {'owner':owner,'id':run_id,'now':_now(),'stamp':stamp}).rowcount
                if changed:
                    s.execute(text('UPDATE career_threads SET active_run_id=NULL WHERE owner=:owner AND active_run_id=:id'),{'owner':owner,'id':run_id})
                    return 'pending'
            return run['status']

    def assert_facts_current(self, owner, provenance, session):
        """Deleting or changing memory while an agent runs invalidates its write."""
        for entry in provenance.values():
            for ref in entry.get('source_ids',[]):
                if not ref.startswith('fact:'):continue
                fact=session.execute(text("SELECT status,confirmed,value FROM career_facts WHERE owner=:owner AND id=:id"),
                                     {'owner':_owner(owner),'id':ref[5:]}).mappings().first()
                if not fact or fact['status']!='active' or not fact['confirmed']:
                    raise CareerStoreError('引用的个人资料已经改变，请重新生成简历')
                value=json.loads(fact['value']) if isinstance(fact['value'],str) else fact['value']
                digest=hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
                expected=entry.get('source_hashes',{}).get(ref)
                if expected and digest!=expected:
                    raise CareerStoreError('引用的个人资料已经改变，请重新生成简历')

    def bind_resume(self, owner, resume_id, run_id, job_snapshot, provenance, session=None):
        with self._session(session) as s:
            run = s.execute(text('SELECT id FROM career_runs WHERE owner=:owner AND id=:id'),
                            {'owner': _owner(owner), 'id': run_id}).first()
            if not run:
                raise CareerStoreError('任务不存在')
            existing = s.execute(text('SELECT * FROM resume_target_bindings WHERE owner=:owner AND run_id=:id'),
                                 {'owner': owner, 'id': run_id}).mappings().first()
            if existing:
                if int(existing['resume_id']) != int(resume_id):
                    raise CareerStoreError('任务已经关联其他简历')
                return _row(existing)
            # Ownership verification applies even when called from an internal agent.
            owned = s.execute(text('SELECT id FROM resumes WHERE id=:id AND user_id=:uid'),
                              {'id': int(resume_id), 'uid': int(owner.split(':')[1])}).first()
            if not owned:
                raise CareerStoreError('简历不存在')
            data = dict(id=uuid.uuid4().hex, owner=owner, resume_id=int(resume_id), run_id=run_id,
                        job_snapshot=_dump(job_snapshot), provenance=_dump(provenance), created_at=_now())
            s.execute(text('INSERT INTO resume_target_bindings (id,owner,resume_id,run_id,job_snapshot,provenance,created_at) '
                           'VALUES (:id,:owner,:resume_id,:run_id,:job_snapshot,:provenance,:created_at)'), data)
            return _row(data)
