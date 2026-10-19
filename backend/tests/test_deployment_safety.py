"""Offline regression checks for deployment connection and download boundaries."""
import ast
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from urllib.parse import quote, unquote

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from deployment_db_config import mysql_connection_config


class DeploymentSafetyTests(unittest.TestCase):
    def test_mysql_target_comes_from_database_url_with_encoded_credentials(self):
        password = 'p@ss:/?#% 汉字'
        url = 'mysql+pymysql://reader:' + quote(password, safe='') + '@mysql-new:3309/xingtu'
        with patch.dict(os.environ, {'DATABASE_URL': url, 'MYSQL_HOST': 'stale-host'}):
            config = mysql_connection_config()
        self.assertEqual((config['host'], config['port'], config['database']), ('mysql-new', 3309, 'xingtu'))
        self.assertEqual(config['user'], 'reader')
        self.assertEqual(config['password'], password)

    def test_missing_database_url_fails_instead_of_using_legacy_server(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(KeyError):
                mysql_connection_config()

    def test_empty_database_rejected(self):
        with patch.dict(os.environ, {'DATABASE_URL': 'mysql+pymysql://reader@mysql-new/'}):
            with self.assertRaises(RuntimeError):
                mysql_connection_config()

    def test_unicode_download_headers_are_ascii_and_preserve_filename(self):
        # Load this pure helper without importing the app or connecting to any DB.
        source = ast.parse((BACKEND / 'routers/resume_center.py').read_text(encoding='utf-8'))
        helper = next(n for n in source.body if isinstance(n, ast.FunctionDef) and n.name == '_download_header')
        namespace = {'quote': quote}
        exec(compile(ast.Module(body=[helper], type_ignores=[]), '<download helper>', 'exec'), namespace)
        for ext in ['pdf', 'docx', 'txt', 'json', 'html']:
            for title in ['中文简历', '简历 "A"; 个人', '标题\r\n额外字段']:
                filename = title + '.' + ext
                with self.subTest(extension=ext, title=title):
                    header = namespace['_download_header'](filename)
                    header.encode('latin-1')  # Starlette encodes response headers this way.
                    self.assertTrue(header.isascii())
                    self.assertNotIn('\r', header)
                    self.assertNotIn('\n', header)
                    encoded = header.split("filename*=UTF-8''", 1)[1]
                    self.assertEqual(unquote(encoded), filename)
                    self.assertIn('filename="resume.' + ext + '"', header)


if __name__ == '__main__':
    unittest.main()
