from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from pydantic import BaseModel, Field

from database import Enterprise, EnterpriseVerification


CREDIT_ALPHABET = '0123456789ABCDEFGHJKLMNPQRTUWXY'
CREDIT_WEIGHTS = (1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28)


class VerificationSubmission(BaseModel):
    credit_code: str = Field(max_length=32)


class VerificationDecision(BaseModel):
    submission_id: str = Field(min_length=32, max_length=32)
    approved: bool
    registration_checked: bool = False
    authorization_checked: bool = False
    note: str = Field(max_length=500)


def validate_credit_code(raw: str) -> str:
    code = raw.strip().upper()
    if len(code) != 18 or any(char not in CREDIT_ALPHABET for char in code):
        raise HTTPException(422, '请输入18位统一社会信用代码')
    if not code[2:8].isdigit():
        raise HTTPException(422, '统一社会信用代码结构不正确')
    total = sum(CREDIT_ALPHABET.index(char) * weight for char, weight in zip(code, CREDIT_WEIGHTS))
    if code[-1] != CREDIT_ALPHABET[-total % 31]:
        raise HTTPException(422, '统一社会信用代码校验位不正确')
    return code


def current_verification(session, enterprise, *, lock=False):
    record = session.get(
        EnterpriseVerification, enterprise.id,
        with_for_update=True if lock else None,
    )
    return record if record and record.company_name == enterprise.company_name else None


def verification_data(record, *, reviewer=False):
    if record is None:
        return {'status': 'unsubmitted'}
    data = {'status': record.status, 'submission_id': record.submission_id,
            'company_name': record.company_name, 'credit_code': record.credit_code}
    if record.status == 'rejected' or reviewer:
        data['review_note'] = record.review_note
    return data


def lock_enterprise(session, enterprise_id):
    enterprise = session.query(Enterprise).filter_by(id=enterprise_id).with_for_update().first()
    if enterprise is None:
        raise HTTPException(404, '企业不存在')
    return enterprise


def require_approved_enterprise(session, enterprise_id):
    enterprise = lock_enterprise(session, enterprise_id)
    record = current_verification(session, enterprise, lock=True)
    if record is None or record.status != 'approved':
        raise HTTPException(403, '企业尚未通过平台人工核验，暂时无法站内沟通')
    return enterprise


def submit(session, enterprise_id, raw_code):
    code = validate_credit_code(raw_code)
    enterprise = lock_enterprise(session, enterprise_id)
    if not (enterprise.company_name or '').strip():
        raise HTTPException(409, '请先填写营业执照上的企业全称')
    record = session.get(EnterpriseVerification, enterprise.id)
    if record and record.company_name == enterprise.company_name and record.status in ('pending', 'approved'):
        if record.credit_code == code:
            return verification_data(record)
        raise HTTPException(409, '当前已有待审核或已认证的申请，请联系管理员处理')
    if record is None:
        record = EnterpriseVerification(enterprise_id=enterprise.id)
        session.add(record)
    record.submission_id = uuid4().hex
    record.company_name = enterprise.company_name
    record.credit_code = code
    record.status = 'pending'
    record.submitted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    record.reviewed_at = record.reviewer_id = record.review_note = None
    data = verification_data(record)
    session.commit()
    return data


def review(session, enterprise_id, reviewer_id, decision):
    enterprise = lock_enterprise(session, enterprise_id)
    record = current_verification(session, enterprise)
    if (record is None or record.submission_id != decision.submission_id
            or (record.status != 'pending' and not (record.status == 'approved' and not decision.approved))):
        raise HTTPException(409, '申请已更新，请刷新后重新审核')
    if not decision.note.strip():
        raise HTTPException(422, '请填写核验依据或驳回原因')
    if decision.approved and not (decision.registration_checked and decision.authorization_checked):
        raise HTTPException(422, '请先核对工商登记和账号的企业授权')
    record.status = 'approved' if decision.approved else 'rejected'
    record.review_note = decision.note.strip()
    record.reviewer_id = reviewer_id
    record.reviewed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    data = verification_data(record, reviewer=True)
    session.commit()
    return data
