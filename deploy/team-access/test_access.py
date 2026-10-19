"""Offline rejection tests; live forwarding must also be tested on the new server."""
import base64
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('team_access_server', Path(__file__).with_name('server.py'))
server = importlib.util.module_from_spec(spec)
# server.py uses Unix-only pwd/fcntl. This test runs in Linux / the new server.
spec.loader.exec_module(server)


class DeviceInputTests(unittest.TestCase):
    def setUp(self):
        blob = b'\x00\x00\x00\x0bssh-ed25519\x00\x00\x00\x20' + bytes(range(32))
        self.key = 'ssh-ed25519 ' + base64.b64encode(blob).decode()

    def test_untrusted_key_comment_cannot_add_an_option_or_a_second_key(self):
        line = server.validated_key(self.key + ' arbitrary-comment', 'device_1')
        self.assertEqual(line.count(' ssh-ed25519 '), 1)
        self.assertNotIn('arbitrary-comment', line)
        self.assertTrue(line.endswith('xingtu-device:device_1'))

    def test_device_name_cannot_inject_shell_or_authorized_keys_lines(self):
        for name in ['../root', 'a b', 'a\nb', '$(id)', '', 'a'*65]:
            with self.subTest(name=name), self.assertRaises(ValueError):
                server.validated_key(self.key, name)

    def test_malformed_or_wrong_algorithm_public_keys_rejected(self):
        for key in ['ssh-rsa AAAA', 'ssh-ed25519 AAAA', 'ssh-ed25519 @@@@']:
            with self.subTest(key=key), self.assertRaises((ValueError, base64.binascii.Error)):
                server.validated_key(key, 'device')


if __name__ == '__main__':
    unittest.main()
