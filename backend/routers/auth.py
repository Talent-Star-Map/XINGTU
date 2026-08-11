"""认证路由 — 注册/登录/简历 CRUD/管理员登录

@owner: 佳豪（求职端"我的"+企业端企业信息+幻觉防控）
"""
import os
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from database import create_user, get_user_by_login, create_token, verify_token, get_session, get_user_model_by_role, Jobseeker, Enterprise, VerifyCode
import bcrypt, random, re, smtplib, uuid
from email.mime.text import MIMEText

router = APIRouter(prefix='/api/auth', tags=['auth'])

SMTP_HOST = 'smtp.qq.com'; SMTP_PORT = 465; SMTP_USER = '3757913901@qq.com'; SMTP_PASS = os.getenv('SMTP_PASSWORD', '')

class RegisterReq(BaseModel):
    account: str; password: str; code: str; role: str = 'jobseeker'; username: str = ''
class LoginReq(BaseModel):
    account: str; password: str; role: str = ''
class SendCodeReq(BaseModel):
    account: str
class ProfileUpdate(BaseModel):
    real_name: str = ''; phone: str = ''; gender: str = ''; age: int | None = None
    education: str = ''; school: str = ''; city: str = ''; target_city: str = ''
    expected_salary: str = ''; target_position: str = ''; experience: str = ''; skills: str = ''; bio: str = ''
    avatar: str = ''; projects: str = ''
    company_name: str = ''; industry: str = ''; company_size: str = ''
    company_desc: str = ''; company_website: str = ''; company_logo: str = ''; company_benefits: str = ''; verified: int = 0

def send_email(to, code):
    body = f'''<div style="max-width:560px;margin:0 auto;padding:32px;font-family:sans-serif;background:#fff;border-radius:16px"><div style="text-align:center;margin-bottom:24px"><span style="font-size:28px;font-weight:800;background:linear-gradient(135deg,#0052D9,#5B21B6);-webkit-background-clip:text;color:transparent">✦ 星图</span></div><p style="font-size:14px;color:#434654">您好！<br>您的验证码为：</p><div style="text-align:center;margin:24px 0"><span style="display:inline-block;font-size:36px;font-weight:800;letter-spacing:8px;padding:12px 32px;background:#f0f4ff;border-radius:12px;color:#0052D9">{code}</span></div><p style="font-size:12px;color:#8a8fa0">星图 · 岗位能力图谱系统</p></div>'''
    msg = MIMEText(body, 'html', 'utf-8')
    msg['Subject'] = f'星图验证码：{code}'; msg['From'] = SMTP_USER; msg['To'] = to
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as s: s.login(SMTP_USER, SMTP_PASS); s.send_message(msg)

@router.post('/send-code')
def send_code(req: SendCodeReq):
    if '@' not in req.account: raise HTTPException(400, '目前仅支持邮箱注册')
    code = ''.join(random.choices('0123456789', k=6))
    session = get_session()
    session.query(VerifyCode).filter(VerifyCode.target == req.account).delete()
    session.add(VerifyCode(target=req.account, code=code))
    session.commit(); session.close()
    try: send_email(req.account, code); return {'success': True, 'message': '验证码已发送到邮箱'}
    except Exception: print(f'\n===== 验证码 [{req.account}]：{code} =====\n'); return {'success': True, 'message': f'验证码: {code}'}

@router.post('/register')
def register(req: RegisterReq):
    if not req.account or '@' not in req.account: raise HTTPException(400, '请输入有效的邮箱')
    if len(req.password) < 8: raise HTTPException(400, '密码至少8位')
    if not re.search(r'[a-z]', req.password): raise HTTPException(400, '密码需包含小写字母')
    if not re.search(r'[A-Z]', req.password): raise HTTPException(400, '密码需包含大写字母')
    if not re.search(r'\d', req.password): raise HTTPException(400, '密码需包含数字')
    session = get_session()
    vc = session.query(VerifyCode).filter(VerifyCode.target == req.account).order_by(VerifyCode.id.desc()).first()
    session.close()
    if not vc or vc.code != req.code: raise HTTPException(400, '验证码错误')
    try:
        create_user(email=req.account, phone=None, password=req.password, role=req.role, username=req.username)
    except ValueError as e: raise HTTPException(400, str(e))
    return {'success': True, 'message': '注册成功，请登录'}

@router.post('/login')
def login(req: LoginReq):
    user = get_user_by_login(req.account)
    if not user: raise HTTPException(400, '账号未注册')
    if not bcrypt.checkpw(req.password.encode(), user['password'].encode()): raise HTTPException(400, '密码错误')
    if req.role and user['role'] != req.role:
        raise HTTPException(400, f'该账号不是{ "求职者" if req.role == "jobseeker" else "企业" }账户，请切换入口登录')
    token = create_token(user['id'], user['role'])
    return {'success': True, 'data': {k: v for k, v in user.items() if k != 'password'} | {'token': token}}

# ─── 管理员登录 — 仅校验邮箱+密码，无验证码、无注册流程 ──────────────────────
class AdminLoginReq(BaseModel):
    account: str; password: str

@router.post('/admin/login')
def admin_login(req: AdminLoginReq):
    """管理员登录入口：仅允许 admins 表中的账号登录"""
    user = get_user_by_login(req.account)
    # 必须命中管理员账号，否则拒绝（防止求职者/企业账号通过此接口登录管理员端）
    if not user or user['role'] != 'admin':
        raise HTTPException(400, '管理员账号不存在或账号类型错误')
    if not bcrypt.checkpw(req.password.encode(), user['password'].encode()):
        raise HTTPException(400, '密码错误')
    token = create_token(user['id'], 'admin')
    return {'success': True, 'data': {k: v for k, v in user.items() if k != 'password'} | {'token': token}}

@router.get('/profile')
def get_profile(token: str = Query(...)):
    try: payload = verify_token(token)
    except ValueError as e: raise HTTPException(401, str(e))
    session = get_session()
    Model = get_user_model_by_role(payload['role'])
    user = session.query(Model).filter(Model.id == payload['user_id']).first()
    session.close()
    if not user: raise HTTPException(404, '用户不存在')
    fields = ['id','email','phone','username','role','avatar','real_name','gender','age','education','school','city','target_city','expected_salary','target_position','experience','skills','bio','projects','company_name','industry','company_size','company_desc','company_website','company_logo','company_benefits','verified']
    data = {}
    for f in fields:
        val = getattr(user, f, None)
        data[f] = val if val is not None else ''
    data['role'] = payload['role']
    return {'success': True, 'data': data}

@router.put('/profile')
def update_profile(req: ProfileUpdate, token: str = Query(...)):
    try: payload = verify_token(token)
    except ValueError as e: raise HTTPException(401, str(e))
    session = get_session()
    Model = get_user_model_by_role(payload['role'])
    user = session.query(Model).filter(Model.id == payload['user_id']).first()
    if not user: raise HTTPException(404, '用户不存在')
    for k, v in req.model_dump().items():
        if hasattr(user, k):
            setattr(user, k, v)
    session.commit(); session.close()
    return {'success': True, 'message': '保存成功'}

import os, shutil

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), '..', 'uploads')
os.makedirs(os.path.join(UPLOAD_DIR, 'avatars'), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, 'resumes'), exist_ok=True)

@router.post('/avatar')
async def upload_avatar(file: UploadFile = File(...), token: str = Query(...)):
    try: payload = verify_token(token)
    except ValueError as e: raise HTTPException(401, str(e))
    ext = file.filename.split('.')[-1].lower() if '.' in (file.filename or '') else 'png'
    if ext not in ('png', 'jpg', 'jpeg', 'webp'): raise HTTPException(400, '仅支持 png/jpg/jpeg/webp')
    name = f"{payload['user_id']}_{uuid.uuid4().hex[:8]}.{ext}"
    path = os.path.join(UPLOAD_DIR, 'avatars', name)
    with open(path, 'wb') as f: shutil.copyfileobj(file.file, f)
    url = f'/uploads/avatars/{name}'
    session = get_session()
    Model = get_user_model_by_role(payload['role'])
    user = session.query(Model).filter(Model.id == payload['user_id']).first()
    if user: user.avatar = url
    session.commit(); session.close()
    return {'success': True, 'data': {'url': url}}

# 文件大小限制（建议 #8 合规）
MAX_FILE_SIZE = {
    'pdf': 5 * 1024 * 1024,    # 5MB
    'doc': 10 * 1024 * 1024,   # 10MB
    'docx': 10 * 1024 * 1024,  # 10MB
    'txt': 2 * 1024 * 1024,    # 2MB
}

@router.post('/resume-parse')
async def resume_parse(file: UploadFile = File(...), token: str = Query(...)):
    try: payload = verify_token(token)
    except ValueError as e: raise HTTPException(401, str(e))
    ext = file.filename.split('.')[-1].lower() if '.' in (file.filename or '') else ''
    if ext not in ('pdf', 'docx', 'doc', 'txt'): raise HTTPException(400, '仅支持 pdf/docx/doc/txt')

    # 大小校验（建议 #8）
    content = await file.read()
    max_size = MAX_FILE_SIZE.get(ext, 5 * 1024 * 1024)
    if len(content) > max_size:
        raise HTTPException(400, f'文件过大，{ext.upper()} 最大 {max_size // 1024 // 1024}MB')

    name = f"{payload['user_id']}_{uuid.uuid4().hex[:8]}.{ext}"
    path = os.path.join(UPLOAD_DIR, 'resumes', name)
    with open(path, 'wb') as f: f.write(content)

    from services.resume_parser import parse_resume
    import json as _json
    result = parse_resume(path)
    cache_path = path + '.json'
    with open(cache_path, 'w', encoding='utf-8') as f:
        _json.dump({**result.get('data', {}), 'filename': file.filename, 'parsed_at': __import__('datetime').datetime.now().isoformat()}, f, ensure_ascii=False)

    # PII 脱敏日志：只打印 uid + 文件名，不打印手机号/邮箱（建议 #8）
    print(f'[resume-parse] uid={payload["user_id"]} file={file.filename} size={len(content)} method={result.get("data",{}).get("method","")}')
    return result

@router.get('/resume-history')
def resume_history(token: str = Query(...)):
    try: payload = verify_token(token)
    except ValueError as e: raise HTTPException(401, str(e))
    uid = payload['user_id']
    import glob as _glob
    import json as _json
    pattern = os.path.join(UPLOAD_DIR, 'resumes', f'{uid}_*')
    files = []
    for f in sorted(_glob.glob(pattern), reverse=True):
        if f.endswith('.json'): continue
        base = os.path.basename(f)
        info: dict = {'path': base, 'date': '', 'skills': [], 'name': '', 'target_position': '', 'filename': base, 'skill_count': 0}
        try:
            st = os.stat(f)
            info['date'] = __import__('datetime').datetime.fromtimestamp(st.st_mtime).strftime('%Y-%m-%d %H:%M')
        except Exception: pass
        cache = f + '.json'
        if os.path.exists(cache):
            try:
                with open(cache, 'r', encoding='utf-8') as cf:
                    c = _json.load(cf)
                info['skills'] = c.get('skills', [])
                info['skill_count'] = len(info['skills'])
                info['name'] = c.get('name', '')
                info['target_position'] = c.get('target_position', '')
                info['filename'] = c.get('filename', base)
            except Exception: pass
        files.append(info)
    return {'success': True, 'data': files}

@router.post('/resume-reparse')
def resume_reparse(filename: str = Query(...), token: str = Query(...)):
    try: payload = verify_token(token)
    except ValueError as e: raise HTTPException(401, str(e))
    uid = payload['user_id']
    safe = os.path.basename(filename)
    if not safe.startswith(f'{uid}_'): raise HTTPException(403, '无权访问')
    path = os.path.join(UPLOAD_DIR, 'resumes', safe)
    if not os.path.exists(path): raise HTTPException(404, '文件不存在')
    from services.resume_parser import parse_resume
    import json as _json
    result = parse_resume(path)
    cache_path = path + '.json'
    with open(cache_path, 'w', encoding='utf-8') as f:
        _json.dump({**result.get('data', {}), 'filename': filename, 'parsed_at': __import__('datetime').datetime.now().isoformat()}, f, ensure_ascii=False)
    return result

@router.delete('/resume-delete')
def resume_delete(filename: str = Query(...), token: str = Query(...)):
    try: payload = verify_token(token)
    except ValueError as e: raise HTTPException(401, str(e))
    uid = payload['user_id']
    safe = os.path.basename(filename)
    if not safe.startswith(f'{uid}_'): raise HTTPException(403, '无权删除')
    path = os.path.join(UPLOAD_DIR, 'resumes', safe)
    deleted = []
    for p in [path, path + '.json']:
        if os.path.exists(p):
            os.remove(p)
            deleted.append(os.path.basename(p))
    return {'success': True, 'message': f'已删除 {len(deleted)} 个文件', 'data': deleted}
