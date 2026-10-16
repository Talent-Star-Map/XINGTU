"""Collect the current public Zhilian split-list UI using a saved browser session.

Only visible public fields are stored. Login-gated descriptions and masked
salary values remain missing; verification challenges stop this source.
"""
import json
import os
import re
from datetime import datetime
from urllib.parse import quote, urlsplit, urlunsplit

from .tencent import extract_skills, persist, plain
from .role_catalog import classify_title

DEFAULT_KEYWORDS = 'Java,Python,Go,前端,大模型,测试工程师,大数据,云原生,网络安全,数据治理'
BASE = 'https://www.zhaopin.com'


def challenge_reason(title, content, url):
    text = (title + '\n' + content).lower()
    if any(x in text for x in ('security verification', '请完成安全验证', '请验证你是人类', '拖动滑块完成验证')):
        return 'site_verification_required'
    if any(x in url.lower() for x in ('/passport', '/login', '/captcha')):
        return 'session_login_required'
    return None


def validate_job_url(value):
    parts = urlsplit(value or '')
    valid_host = parts.hostname in ('www.zhaopin.com', 'jobs.zhaopin.com')
    valid_path = parts.path.startswith('/jobdetail/') if parts.hostname == 'www.zhaopin.com' else True
    match = re.fullmatch(r'(?:/jobdetail)?/([A-Za-z0-9_-]+)\.html?', parts.path)
    if parts.scheme != 'https' or not valid_host or not valid_path or not match:
        raise ValueError('invalid Zhilian job source URL')
    return urlunsplit(('https', parts.hostname, parts.path, '', '')), match.group(1)


def search_listings(scripts):
    """Use rendered page identities, excluding cookies, people and hidden fields."""
    for script in scripts:
        match = re.match(r'^\s*(?:window\.)?__INITIAL_STATE__\s*=\s*', script)
        if not match:
            continue
        data, end = json.JSONDecoder().raw_decode(script[match.end():])
        if script[match.end()+end:].strip() not in ('', ';'):
            raise ValueError('unexpected code after page JSON')
        rows = data.get('positionList')
        if not isinstance(rows, list) or data.get('listLoadError'):
            raise ValueError('Zhilian search schema changed')
        result = []
        for row in rows:
            url, identity = validate_job_url(row.get('positionURL') or row.get('positionUrl'))
            if str(row.get('number')) != identity:
                raise ValueError('job identity disagrees with source URL')
            result.append({'url': url, 'id': identity, 'title': plain(row.get('name')),
                           'company': plain(row.get('companyName'))})
        return result
    raise ValueError('missing Zhilian search state')


def normalize(item, description, observed_at):
    url, identity = validate_job_url(item.get('url'))
    title, company = plain(item.get('title')), plain(item.get('company'))
    if not title or not company:
        raise ValueError('missing visible job identity')
    if description and challenge_reason('', description, url):
        raise ValueError('verification page cannot be a description')
    description = plain(description) or None
    if description and len(description) < 30:
        raise ValueError('incomplete job description')
    visible_text = title + '\n' + (description or '') + '\n' + '\n'.join(item.get('tags') or [])
    evidence = extract_skills(visible_text)
    category = classify_title(title)
    salary = plain(item.get('salary'))
    return {'source': '智联招聘', 'source_job_id': identity, 'source_url': url,
            'title': title, 'company_name': company, 'city': plain(item.get('city')),
            'experience': plain(item.get('experience')) or None,
            'description': description, 'category': category[0] if category else '',
            'skills': sorted(evidence), 'skill_evidence': evidence, 'observed_at': observed_at,
            'raw_salary': salary if salary and '*' not in salary else None,
            'education': plain(item.get('education')) or None,
            'description_scope': 'full_public' if description else 'login_required'}


def collect(max_details=50, max_pages=1, delay=3.0):
    from playwright.sync_api import sync_playwright, TimeoutError as BrowserTimeout
    keywords = [x.strip() for x in os.getenv('ZHILIAN_KEYWORDS', DEFAULT_KEYWORDS).split(',') if x.strip()]
    per_keyword = min(10, max(1, int(os.getenv('ZHILIAN_MAX_PER_KEYWORD', '5'))))
    profile = os.getenv('ZHILIAN_PROFILE_DIR', '/app/browser_data/zhilian')
    counts = {'listed': 0, 'new_raw': 0, 'updated_raw': 0, 'detail_failed': 0,
              'full_public_details': 0, 'details_login_required': 0, 'keywords_checked': 0, 'empty_keywords': 0}
    seen = set()
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            profile, headless=False, args=['--no-sandbox', '--disable-dev-shm-usage'],
            viewport={'width': 1280, 'height': 900}, locale='zh-CN')
        context.set_default_timeout(15000)
        page = context.pages[0] if context.pages else context.new_page()
        try:
            for keyword in keywords:
                if counts['new_raw'] + counts['updated_raw'] + counts['detail_failed'] >= max_details:
                    break
                counts['keywords_checked'] += 1
                response = page.goto(BASE + '/jobs/?jl=489&kw=' + quote(keyword), wait_until='domcontentloaded', timeout=45000)
                if response and response.status in (401, 403, 429):
                    counts.update(status='blocked', reason='HTTP_' + str(response.status))
                    return counts
                try:
                    page.locator('.job-card').first.wait_for(timeout=30000)
                except BrowserTimeout:
                    reason = challenge_reason(page.title(), page.content(), page.url)
                    if not reason and search_listings(page.locator('script').all_text_contents()) == []:
                        counts['empty_keywords'] += 1
                        page.wait_for_timeout(int(delay * 1000))
                        continue
                    counts.update(status='blocked' if reason else 'failed', reason=reason or 'no_public_job_cards')
                    return counts
                sources = search_listings(page.locator('script').all_text_contents())
                cards = page.locator('.job-card')
                counts['listed'] += len(sources)
                for index in range(min(per_keyword, len(sources), cards.count())):
                    if counts['new_raw'] + counts['updated_raw'] + counts['detail_failed'] >= max_details:
                        break
                    source = sources[index]
                    if source['id'] in seen:
                        continue
                    seen.add(source['id'])
                    try:
                        card = cards.nth(index)
                        title = card.locator('.vue-clamp__text').first.get_attribute('aria-label') or card.locator('.job-card__title-main').inner_text()
                        company = card.locator('.job-card__company-name').inner_text()
                        compact = lambda x: re.sub(r'\s+', '', plain(x))
                        if compact(title) != compact(source['title']) or compact(company) != compact(source['company']):
                            raise ValueError('visible card and page identity mismatch')
                        tags = card.locator('.job-card__skill-tag').all_inner_texts()
                        item = {**source, 'title': title, 'company': company, 'tags': tags,
                                'salary': card.locator('.job-card__salary').inner_text(),
                                'city': card.locator('.job-card__location').inner_text().strip().split(' ')[0],
                                'education': next((t for t in tags if t in ('博士', '硕士', '本科', '大专', '中专', '高中', '学历不限')), None),
                                'experience': next((t for t in tags if re.fullmatch(r'\d+(?:-\d+)?年以上?|经验不限|无经验|在校/应届', t)), None)}
                        card.locator('.job-card__title-main').click()
                        page.wait_for_timeout(int(delay * 1000))
                        reason = challenge_reason(page.title(), page.content(), page.url)
                        if reason:
                            counts.update(status='blocked', reason=reason)
                            return counts
                        panel = page.locator('.job-detail-panel')
                        panel.get_by_text(plain(title), exact=True).first.wait_for(timeout=15000)
                        description = None
                        body = panel.locator('.job-description__content')
                        # A login gate can visually clip text still present in the DOM.
                        # Never extract that concealed text or salary from initial state.
                        gate = panel.locator('.job-detail-login-gate')
                        gated = gate.count() and gate.first.is_visible()
                        clipped = body.count() and 'guest-clamp' in (body.first.get_attribute('class') or '')
                        if body.count() == 1 and not gated and not clipped:
                            description = body.inner_text()
                        record = normalize(item, description, datetime.utcnow())
                        is_new = persist(record, {'listing': item, 'description': description,
                                                 'description_scope': record['description_scope']})
                        counts['new_raw' if is_new else 'updated_raw'] += 1
                        counts['full_public_details' if description else 'details_login_required'] += 1
                    except (BrowserTimeout, ValueError) as exc:
                        counts['detail_failed'] += 1
                        print(json.dumps({'source': 'zhilian', 'record_error': type(exc).__name__, 'job_id': source['id']}), flush=True)
                        if counts['detail_failed'] >= 3:
                            counts.update(status='failed', reason='page_schema_or_record_failure')
                            return counts
                page.wait_for_timeout(int(delay * 1000))
        finally:
            context.close()
    counts['status'] = ('partial_failure' if counts['detail_failed'] else 'succeeded') if counts['new_raw'] + counts['updated_raw'] else 'empty'
    return counts
