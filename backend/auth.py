from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from database import create_user, get_user_by_login, create_token, verify_token, get_session, User, VerifyCode
import bcrypt, random, re, smtplib
from email.mime.text import MIMEText

router = APIRouter(prefix='/api/auth', tags=['auth'])

SMTP_HOST = 'smtp.qq.com'; SMTP_PORT = 465; SMTP_USER = '3757913901@qq.com'; SMTP_PASS = 'hjncdropikuccjef'

class RegisterReq(BaseModel):
    account: str; password: str; code: str; role: str = 'jobseeker'; username: str = ''
class LoginReq(BaseModel):
    account: str; password: str; role: str = ''
class SendCodeReq(BaseModel):
    account: str
class ProfileUpdate(BaseModel):
    real_name: str = ''; gender: str = ''; age: int | None = None
    education: str = ''; school: str = ''; city: str = ''; target_city: str = ''
    expected_salary: str = ''; target_position: str = ''; experience: str = ''; skills: str = ''; bio: str = ''

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
    except: print(f'\n===== 验证码 [{req.account}]：{code} =====\n'); return {'success': True, 'message': f'验证码: {code}'}

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

@router.get('/profile')
def get_profile(token: str = Query(...)):
    try: payload = verify_token(token)
    except ValueError as e: raise HTTPException(401, str(e))
    session = get_session()
    user = session.query(User).filter(User.id == payload['user_id']).first()
    session.close()
    if not user: raise HTTPException(404, '用户不存在')
    fields = ['id','email','phone','username','role','avatar','real_name','gender','age','education','school','city','target_city','expected_salary','target_position','experience','skills','bio']
    return {'success': True, 'data': {f: getattr(user, f) if getattr(user, f, None) is not None else '' for f in fields}}

@router.put('/profile')
def update_profile(req: ProfileUpdate, token: str = Query(...)):
    try: payload = verify_token(token)
    except ValueError as e: raise HTTPException(401, str(e))
    session = get_session()
    user = session.query(User).filter(User.id == payload['user_id']).first()
    if not user: raise HTTPException(404, '用户不存在')
    for k, v in req.model_dump().items():
        setattr(user, k, v)
    session.commit(); session.close()
    return {'success': True, 'message': '保存成功'}
