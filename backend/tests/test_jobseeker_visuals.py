"""Offline evidence/aggregation regression, no cloud writes or model calls."""
import os
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.jobseeker_visuals import prepare, aggregate, percentile
from services.china_regions import province_for_city


def row(**kwargs):
    return {'id': 1, 'title': 'Python开发工程师', 'source': '智联招聘', 'source_url': 'https://jobs.example/1',
            'skill_tags': ['Python', 'python', 'SQL'], 'city': '北京', 'company_name': '公司甲',
            'salary_min': 10000, 'salary_max': 20000, 'experience': '1-3年', 'crawl_time': None, **kwargs}


class VisualTests(unittest.TestCase):
    def test_only_sourced_technical_non_ai_postings_and_dedup(self):
        data = [row(), row(id=2), row(source_url=''), row(title='货运司机', source_url='https://jobs.example/3'),
                row(source='ai_discovered', source_url='https://jobs.example/4')]
        clean = prepare(data)
        self.assertEqual(len(clean), 1)
        self.assertEqual(clean[0]['skills'], ['Python', 'SQL'])

    def test_unknown_salary_is_not_zero_and_invalid_ranges_excluded(self):
        data = prepare([row(), row(id=2, source_url='https://jobs.example/2', salary_min=None),
                        row(id=3, source_url='https://jobs.example/3', salary_min=50000, salary_max=20000)])
        summary = aggregate(data)
        self.assertEqual(summary['total_jobs'], 3)
        self.assertEqual(summary['salary_samples'], 1)
        self.assertEqual(summary['cities'][0]['median_salary_k'], 15)

    def test_company_count_and_skill_rate_are_deduplicated(self):
        summary = aggregate(prepare([row(), row(id=2, source_url='https://jobs.example/2')]))
        self.assertEqual(summary['companies'], 1)
        self.assertEqual(summary['skills'][0]['count'], 2)
        self.assertEqual(summary['skills'][0]['rate'], 100)

    def test_direction_and_experience_filters(self):
        self.assertEqual(len(prepare([row()], '软件研发', '1-3')), 1)
        self.assertEqual(prepare([row()], '人工智能与大模型'), [])
        self.assertEqual(prepare([row()], experience='5-10'), [])

    def test_quantiles_use_linear_interpolation(self):
        self.assertEqual(percentile([10, 20, 30, 40], .25), 17.5)
        self.assertEqual(percentile([20], .75), 20)

    def test_city_mapping_never_places_foreign_city_in_china(self):
        self.assertEqual(province_for_city('深圳市'), '广东省')
        self.assertEqual(province_for_city('中国香港'), '香港特别行政区')
        self.assertIsNone(province_for_city('新加坡'))
        self.assertIsNone(province_for_city('地点未注明'))


if __name__ == '__main__':
    unittest.main()
