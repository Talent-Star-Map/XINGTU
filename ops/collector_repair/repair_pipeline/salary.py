"""Parse only explicitly advertised monthly RMB ranges, never infer pay."""
import re
from decimal import Decimal


def monthly_salary(value):
    raw = str(value or '').strip().replace(' ', '').replace(',', '')
    match = re.fullmatch(r'(\d+(?:\.\d+)?)([kK千万]?)\s*[-—~～至]\s*'
                         r'(\d+(?:\.\d+)?)([kK千万]|元)(?:元)?(?:/月|每月)?'
                         r'(?:[·・x×](\d{1,2})薪)?', raw)
    if not match:
        return None
    low, unit1, high, unit2, months = match.groups()
    unit1 = unit1 or unit2
    units = {'k': 1000, 'K': 1000, '千': 1000, '万': 10000, '元': 1}
    low, high = int(Decimal(low) * units[unit1]), int(Decimal(high) * units[unit2])
    if not 0 < low <= high or months and not 12 <= int(months) <= 24:
        return None
    return low, high, int(months) if months else None
