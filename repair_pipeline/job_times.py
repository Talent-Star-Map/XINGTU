"""Source dates are evidence, never a fallback to the crawler clock.

Database datetimes are naive UTC. Date-only/relative evidence keeps its precision.
An update/refresh time is NEVER promoted to a publication time.
"""
import re
from datetime import datetime, timedelta, timezone

SHANGHAI = timezone(timedelta(hours=8))


def utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def parse_source_time(value, observed_at):
    if value is None or value == '':
        return None, None
    now = utc(observed_at).astimezone(SHANGHAI)
    raw = str(value).strip()
    cleaned = re.sub(r'^(?:发布时间|发布日期|更新于|更新时间|发布于|发布|更新)\s*[:：]?\s*', '', raw)
    cleaned = re.sub(r'\s*(?:发布|更新)$', '', cleaned).strip()
    precision = 'second'
    try:
        if isinstance(value, datetime):
            result = value
        elif re.fullmatch(r'\d{10}|\d{13}', cleaned):
            result = datetime.fromtimestamp(int(cleaned) / (1000 if len(cleaned) == 13 else 1), timezone.utc)
        elif re.fullmatch(r'(?:今天|昨日|昨天)(?:\s+\d{1,2}:\d{2})?', cleaned):
            result = now.replace(hour=0, minute=0, second=0, microsecond=0)
            if not cleaned.startswith('今天'):
                result -= timedelta(days=1)
            clock = re.search(r'(\d{1,2}):(\d{2})', cleaned)
            if clock:
                result = result.replace(hour=int(clock[1]), minute=int(clock[2])); precision = 'minute'
            else:
                precision = 'day'
        elif re.fullmatch(r'\d+\s*(?:分钟|小时|天)前', cleaned):
            match = re.fullmatch(r'(\d+)\s*(分钟|小时|天)前', cleaned)
            amount = int(match[1]); unit = match[2]
            result = now - timedelta(**{ {'分钟':'minutes','小时':'hours','天':'days'}[unit]:amount})
            precision = {'分钟':'relative_minute','小时':'relative_hour','天':'relative_day'}[unit]
            if unit == '天':
                result = result.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            formatted = cleaned.replace('年', '-').replace('月', '-').replace('日', '').replace('/', '-')
            if re.fullmatch(r'\d{1,2}-\d{1,2}', formatted):
                formatted = str(now.year) + '-' + formatted
                result = datetime.strptime(formatted, '%Y-%m-%d').replace(tzinfo=SHANGHAI)
                if result.date() > now.date():
                    result = result.replace(year=result.year - 1)
                precision = 'day_year_inferred'
            else:
                result = datetime.fromisoformat(formatted.replace('Z', '+00:00'))
                precision = 'day' if re.fullmatch(r'\d{4}-\d{1,2}-\d{1,2}', formatted) else 'second'
        if result.tzinfo is None:
            result = result.replace(tzinfo=SHANGHAI)
        result = result.astimezone(timezone.utc)
        if result > utc(observed_at) + timedelta(minutes=5) or result.year < 2000:
            return None, None
        return result.replace(tzinfo=None), precision
    except (ValueError, TypeError, OverflowError, OSError):
        return None, None


def time_fields(published_raw, updated_raw, observed_at, published_source='', updated_source=''):
    # A mislabeled frontend value must not smuggle an update into publication.
    if published_raw and any(word in str(published_raw) for word in ('更新', '刷新', '活跃')):
        if not updated_raw:
            updated_raw, updated_source = published_raw, published_source
        published_raw, published_source = None, ''
    published, precision = parse_source_time(published_raw, observed_at)
    updated, update_precision = parse_source_time(updated_raw, observed_at)
    return {
        'publish_time': published, 'source_update_time': updated,
        'publish_time_evidence': {
            'status': 'source_provided' if published else 'missing_or_unparseable',
            'raw': str(published_raw) if published_raw is not None else None,
            'source_field': published_source or None, 'precision': precision,
            'update_raw': str(updated_raw) if updated_raw is not None else None,
            'update_source_field': updated_source or None, 'update_precision': update_precision,
            'observed_at_utc': utc(observed_at).isoformat(),
            'timezone': 'UTC', 'source_timezone_if_unspecified': 'Asia/Shanghai',
        },
    }


def tencent_times(post, observed_at):
    # LastUpdateTime is the common official field: it is an UPDATE, not release.
    def first(keys):
        return next(((post[k], k) for k in keys if post.get(k)), (None, ''))
    published, pkey = first(('PublishTime', 'PublishDate', 'ReleaseTime', 'ReleaseDate'))
    updated, ukey = first(('LastUpdateTime', 'UpdateTime', 'UpdatedTime'))
    return time_fields(published, updated, observed_at, pkey, ukey)
