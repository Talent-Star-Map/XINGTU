"""Deployment bootstrap: wait for existing databases before starting the API."""
import os,time
from sqlalchemy import text
from database import engine,get_neo4j_driver

deadline=time.monotonic()+90
while True:
    try:
        with engine.connect() as connection:connection.execute(text('SELECT 1'))
        get_neo4j_driver().verify_connectivity()
        break
    except Exception as error:
        if time.monotonic()>=deadline:raise RuntimeError('Deployment databases were not ready within 90 seconds') from None
        print('Waiting for deployment databases: '+type(error).__name__,flush=True)
        time.sleep(2)
os.execvp('uvicorn',['uvicorn','main:app','--host','0.0.0.0','--port','8081','--no-access-log'])
