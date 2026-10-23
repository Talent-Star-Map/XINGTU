from pathlib import Path
from dotenv import dotenv_values
from urllib.parse import urlsplit,urlunsplit,quote
root=Path(__file__).resolve().parents[2]
shared=dotenv_values(Path.home()/'.xingtu-access/backend.env')
env=dict(dotenv_values(root/'backend/.env'))
env.update(shared)
def host_uri(value):
 parts=urlsplit(value)
 assert parts.hostname in ('127.0.0.1','localhost'), 'Expected SSH forwarded database'
 auth=parts.netloc.rsplit('@',1)[0]+'@' if '@' in parts.netloc else ''
 return urlunsplit((parts.scheme,auth+'host.docker.internal:'+str(parts.port),parts.path,parts.query,parts.fragment))
env['DATABASE_URL']=host_uri(shared['DATABASE_URL'])
env['NEO4J_URI']=host_uri(shared['NEO4J_URI'])
mongo_auth = quote(shared['MONGO_USER'], safe='') + ':' + quote(shared['MONGO_PASSWORD'], safe='')
mongo_uri = urlunsplit(('mongodb', mongo_auth + '@host.docker.internal:37017', '/',
                       'authSource=admin&directConnection=true', ''))
for k in ('MONGO_URI','MONGODB_URI','MONGO_URL'):env[k]=mongo_uri
env['MONGO_HOST']='host.docker.internal';env['MONGO_PORT']='37017'
env['NEO4J_MOCK']='false';env['XINGTU_SKIP_DB_INIT']='1'
for k,v in env.items():
 if v is not None:assert '\n' not in v and '\r' not in v,k
(root/'tmp').mkdir(exist_ok=True)
(root/'tmp/docker-dev.env').write_text('\n'.join(k+'='+v for k,v in env.items() if v is not None)+'\n',encoding='utf-8')
print('已生成私有Docker开发连接配置：三个数据库通过host.docker.internal使用现有SSH通道，凭证未输出。')
