from dotenv import load_dotenv
load_dotenv()

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import init_db
# 路由模块已迁移到 routers/ 子目录，import 路径需带前缀
from routers.auth import router as auth_router
from routers.jobs import router as jobs_router
from routers.company import router as company_router
from routers.quality_api import router as quality_router
from routers.enterprise import router as enterprise_router
from routers.match_api import router as match_router
from routers.chat_api import router as chat_router
from routers.learning_api import router as learning_router
from routers.admin import router as admin_router
from routers.resume_center import router as resume_router
import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title='星图 API', version='1.0.0', lifespan=lifespan)

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
app.include_router(match_router)
app.include_router(chat_router)
app.include_router(learning_router)
app.include_router(admin_router)
app.include_router(resume_router)

@app.get('/api/health')
def health():
    return {'status': 'ok', 'service': 'xingtu-api'}


if __name__ == '__main__':
    import uvicorn
    port = int(os.getenv('BACKEND_PORT', 8000))
    uvicorn.run('main:app', host='0.0.0.0', port=port, reload=True)
