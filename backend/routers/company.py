"""公开企业名片接口 — 求职端可查看

@owner: 佳豪（企业端企业信息）
"""

from fastapi import APIRouter, Query, HTTPException
from database import get_session, Enterprise

router = APIRouter(prefix='/api/company', tags=['company'])

@router.get('/public/{company_name}')
def get_company_public(company_name: str):
    """根据公司名查询企业公开信息"""
    session = get_session()
    user = session.query(Enterprise).filter(Enterprise.company_name == company_name).first()
    session.close()
    if not user:
        raise HTTPException(404, '企业不存在')
    return {
        'success': True,
        'data': {
            'company_name': user.company_name or '',
            'industry': user.industry or '',
            'company_size': user.company_size or '',
            'company_desc': user.company_desc or '',
            'company_website': user.company_website or '',
            'company_logo': user.company_logo or '',
            'company_benefits': user.company_benefits or '',
            'verified': user.verified or 0,
            'city': user.city or '',
        }
    }
