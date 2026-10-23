import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('daily', Path(__file__).with_name('github_daily.py'))
daily = importlib.util.module_from_spec(spec)
spec.loader.exec_module(daily)


class DailyTests(unittest.TestCase):
    def test_daily_board_identity_rank_and_daily_gain(self):
        html = ''.join(f'<article class="Box-row"><h2><a href="/owner/repo{i}"> owner / repo{i} </a></h2><p>Project</p><span itemprop="programmingLanguage">Python</span><a href="/owner/repo{i}/stargazers">1,234</a><span>123 stars today</span></article>' for i in range(5))
        rows = daily.parse_board(html + html)
        self.assertEqual(len(rows), 5)
        self.assertEqual(rows[0]['rank'], 1)
        self.assertEqual(rows[0]['stars_today'], 123)
        self.assertEqual(rows[0]['stars'], 1234)
        self.assertEqual(rows[0]['source_id'], 'owner/repo0')

    def test_empty_or_blocked_board_fails_instead_of_recording_zero(self):
        with self.assertRaises(ValueError):
            daily.parse_board('<html>rate limit</html>')

    def test_each_label_counted_once_per_repo(self):
        self.assertEqual(daily.labels_for({'primary_language': 'Python', 'topics': ['python', 'RAG', 'rag']}), ['python', 'rag'])


if __name__ == '__main__':
    unittest.main()
