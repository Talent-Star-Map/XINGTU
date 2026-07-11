from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from auth import router as auth_router

app = FastAPI(title='星图 API', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(auth_router)

@app.on_event('startup')
def startup():
    init_db()

@app.get('/api/health')
def health():
    return {'status': 'ok', 'service': 'xingtu-api'}
