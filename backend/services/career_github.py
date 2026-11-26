"""Bounded, read-only GitHub evidence. Repository content never grants authority."""
import base64
import re
from urllib.parse import quote
import httpx


def repository_parts(url):
    match = re.fullmatch(r'https://github\.com/([A-Za-z0-9_.-]{1,100})/([A-Za-z0-9_.-]{1,100})(?:\.git)?/?', url.strip())
    if not match or any(v in ('.', '..') for v in match.groups()):
        raise ValueError('请提供 https://github.com/用户名/仓库名 格式的公开仓库地址')
    return match[1], match[2].removesuffix('.git')


async def inspect_repository(url):
    owner, repo = repository_parts(url)
    prefix = f'https://api.github.com/repos/{owner}/{repo}'
    async with httpx.AsyncClient(timeout=15, follow_redirects=False, headers={'Accept': 'application/vnd.github+json'}) as client:
        async def get(path):
            try:
                response = await client.get(prefix + path)
            except httpx.HTTPError:
                raise ValueError('GitHub连接暂时不可用，可以稍后重试或跳过并手动补充项目') from None
            if response.status_code != 200:
                raise ValueError('仓库暂时无法读取，可能是私有仓库、限流或链接失效；可以跳过并手动补充项目')
            if len(response.content) > 2_000_000:
                raise ValueError('仓库目录过大，请提供项目相关文件')
            return response.json()
        meta = await get('')
        branch = meta.get('default_branch', 'main')
        commit = await get('/commits/' + quote(branch,safe=''))
        sha = commit['sha']
        tree = await get('/git/trees/' + sha + '?recursive=1')
        paths = [x['path'] for x in tree.get('tree', []) if x.get('type') == 'blob' and x.get('size', 0) <= 80000]
        preferred = sorted(paths, key=lambda p: (not p.lower().startswith('readme'), p.count('/'), p))
        selected = [p for p in preferred if re.search(r'(^|/)(readme[^/]*|package\.json|requirements\.txt|pyproject\.toml)$', p, re.I)][:5]
        selected += [p for p in preferred if p not in selected and p.endswith(('.py', '.ts', '.tsx', '.js', '.java'))
                     and not any(x in p.lower() for x in ('node_modules', 'vendor', 'dist/', '.env', 'secret', 'token', 'credential'))][:3]
        evidence = []
        for path in selected:
            data = await get('/contents/' + quote(path,safe='/') + '?ref=' + sha)
            if data.get('type') != 'file' or data.get('encoding') != 'base64':
                continue
            text = base64.b64decode(data['content']).decode('utf-8', errors='replace')[:6500]
            # Do not transmit accidentally committed credentials to a model.
            text = re.sub(r'(?im)^.*(?:api[_-]?key|password|secret|bearer\s+[A-Za-z0-9]|BEGIN .*PRIVATE KEY).*$','[敏感行已省略]',text)
            evidence.append({'id': f'github:{sha}:{path}', 'type': 'github', 'path': path,
                             'commit': sha, 'text': text, 'url': f'https://github.com/{owner}/{repo}/blob/{sha}/{path}',
                             'partial': True, 'claim_scope': 'repository_only_not_personal_contribution'})
        return {'repository': f'{owner}/{repo}', 'commit': sha, 'fork': bool(meta.get('fork')),
                'evidence': evidence, 'partial': True,
                'warning': '仅读取部分文件，未运行代码或测试；仓库实现不等于用户个人贡献，贡献和成果必须确认'}
