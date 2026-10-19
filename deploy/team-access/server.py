"""Restricted SSH access for team devices. Run as root on the NEW server only."""
import argparse
import base64
import fcntl
import json
import os
from pathlib import Path
import pwd
import re
import subprocess
import sys
from urllib.parse import quote, urlsplit, unquote

USER = 'xingtu-connect'
HOME = Path('/var/lib/xingtu-connect')
KEYS = Path('/etc/ssh/xingtu-team/authorized_keys')
CONF = Path('/etc/ssh/sshd_config.d/40-xingtu-team.conf')
PORTS = (3000, 8081, 3308, 7474, 7687, 27017)
CONFIG = f'''# Managed by XINGTU deploy/team-access/server.py; root access unchanged.
Match User {USER}
    AuthenticationMethods publickey
    PasswordAuthentication no
    KbdInteractiveAuthentication no
    PubkeyAuthentication yes
    AuthorizedKeysFile {KEYS}
    AuthorizedKeysCommand none
    AllowTcpForwarding local
    PermitOpen {' '.join('127.0.0.1:'+str(p) for p in PORTS)}
    PermitListen none
    AllowStreamLocalForwarding no
    AllowAgentForwarding no
    X11Forwarding no
    PermitTTY no
    PermitTunnel no
    PermitUserRC no
    MaxSessions 0
    GatewayPorts no
Match all
'''


def validated_key(text, name):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', name):
        raise ValueError('Device name must be 1-64 ASCII letters, digits, _ or -')
    parts = text.strip().split()
    if len(parts) < 2 or parts[0] != 'ssh-ed25519':
        raise ValueError('An Ed25519 public key is required')
    raw = base64.b64decode(parts[1], validate=True)
    if len(raw) != 51 or raw[:19] != b'\x00\x00\x00\x0bssh-ed25519\x00\x00\x00\x20':
        raise ValueError('Malformed public key')
    options = 'restrict,port-forwarding,' + ','.join(
        f'permitopen="127.0.0.1:{p}"' for p in PORTS)
    return f'{options} ssh-ed25519 {parts[1]} xingtu-device:{name}'


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)


def install():
    if not Path('/data/xingtu/secrets/api.env').is_file() or not os.path.ismount('/data'):
        raise RuntimeError('Expected new-server mounted runtime is missing')
    try:
        entry = pwd.getpwnam(USER)
        if entry.pw_dir != str(HOME) or entry.pw_shell != '/usr/sbin/nologin':
            raise RuntimeError('Existing account is not the restricted account; refusing')
    except KeyError:
        run('useradd', '--system', '--home-dir', str(HOME), '--shell', '/usr/sbin/nologin', USER)
    HOME.mkdir(exist_ok=True, mode=0o755)
    os.chown(HOME, 0, 0)
    os.chmod(HOME, 0o755)
    KEYS.parent.mkdir(exist_ok=True, mode=0o755)
    os.chown(KEYS.parent, 0, 0)
    os.chmod(KEYS.parent, 0o755)
    if not KEYS.exists():
        KEYS.touch(mode=0o644)
    os.chown(KEYS, 0, 0)
    os.chmod(KEYS, 0o644)
    previous = CONF.read_bytes() if CONF.exists() else None
    CONF.write_text(CONFIG)
    os.chmod(CONF, 0o644)
    try:
        run('/usr/sbin/sshd', '-t')
    except Exception:
        if previous is None:
            CONF.unlink()
        else:
            CONF.write_bytes(previous)
        raise
    run('systemctl', 'reload', 'ssh')
    print(json.dumps({'installed': True, 'account': USER, 'destinations': PORTS}))


def envfile(name):
    # Deployment env values are plain KEY=value. Do not print this dictionary.
    return dict(line.split('=', 1) for line in Path('/data/xingtu/secrets', name).read_text().splitlines()
                if line.strip() and not line.startswith('#') and '=' in line)


def device(name, key=None):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', name):
        raise ValueError('Invalid device name')
    with KEYS.open('r+') as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        lines = handle.read().splitlines()
        suffix = ' xingtu-device:' + name
        lines = [line for line in lines if not line.endswith(suffix)]
        if key is not None:
            lines.append(validated_key(key, name))
        handle.seek(0)
        handle.write('\n'.join(lines) + ('\n' if lines else ''))
        handle.truncate()
        handle.flush()
        os.fsync(handle.fileno())


def connection_config():
    api = envfile('api.env')
    parsed = urlsplit(api['DATABASE_URL'])
    password = unquote(parsed.password or '')
    mongo = envfile('mongo.env')
    return {
        'DATABASE_URL': f'mysql+pymysql://{quote(unquote(parsed.username or ""), safe="")}:'
                        f'{quote(password, safe="")}@127.0.0.1:13308/xingtu?charset=utf8mb4',
        'MYSQL_PASSWORD': password,
        'NEO4J_URI': 'bolt://127.0.0.1:17687',
        'NEO4J_USER': api.get('NEO4J_USER', 'neo4j'),
        'NEO4J_PASSWORD': api['NEO4J_PASSWORD'],
        'NEO4J_DATABASE': api.get('NEO4J_DATABASE', 'neo4j'),
        'MONGO_USER': mongo['MONGO_INITDB_ROOT_USERNAME'],
        'MONGO_PASSWORD': mongo['MONGO_INITDB_ROOT_PASSWORD'],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['install', 'enroll', 'revoke'])
    parser.add_argument('name', nargs='?')
    args = parser.parse_args()
    if os.geteuid() != 0:
        parser.error('Root is required')
    if args.action == 'install':
        install()
    elif args.action == 'enroll':
        # Credentials travel only over the admin SSH session into a private file.
        config = connection_config()
        device(args.name or '', sys.stdin.read(2048))
        print(json.dumps(config))
    else:
        device(args.name or '')
        print(json.dumps({'revoked': args.name}))


if __name__ == '__main__':
    main()
