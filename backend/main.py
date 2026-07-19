from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import init_db
from auth import router as auth_router
from jobs import router as jobs_router
from company import router as company_router
from quality_api import router as quality_router
from enterprise import router as enterprise_router  # 企业端：人才星
import os

app = FastAPI(title='星图 API', version='1.0.0')

os.makedirs(os.path.join(os.path.dirname(__file__), 'uploads', 'avatars'), exist_ok=True)
app.mount('/uploads', StaticFiles(directory=os.path.join(os.path.dirname(__file__), 'uploads')), name='uploads')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(auth_router)
app.include_router(jobs_router)
app.include_router(company_router)
app.include_router(quality_router)
app.include_router(enterprise_router)

@app.on_event('startup')
def startup():
    init_db()

@app.get('/api/health')
def health():
    return {'status': 'ok', 'service': 'xingtu-api'}
