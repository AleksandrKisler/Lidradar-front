#!/usr/bin/env python3
"""Forced SSH command for frontend-only staging releases. Install outside Git checkout."""

from datetime import datetime, timezone
import os
from pathlib import Path
import re
import subprocess
import sys

BACKEND = Path('/opt/lidradar/Lidradar')
FRONTEND = Path('/opt/lidradar/Lidradar-front')
CONFIG = BACKEND / 'deploy/production/.env'
LOGS = Path.home() / 'lidradar-releases'
SHA = re.compile(r'[0-9a-f]{40}')


class DeployError(Exception):
    pass


def command(*args):
    result = subprocess.run(args, text=True, capture_output=True, check=False)
    if result.returncode:
        raise DeployError(f'Command failed: {args[0]} (exit {result.returncode})')
    return result.stdout.strip()


def public_config(path):
    allowed = {'LIDRADAR_ENV', 'LIDRADAR_DOMAIN', 'COMPOSE_PROJECT_NAME', 'LIDRADAR_VERSION'}
    values = {}
    for line in path.read_text().splitlines():
        key, sep, value = line.partition('=')
        if sep and key in allowed:
            values[key] = value.strip().strip('"\'')
    return values


def prepare(request):
    match = re.fullmatch(r'deploy-web ([0-9a-f]{40})', request)
    if not match:
        raise DeployError('Only deploy-web <sha40> is accepted')
    sha = match.group(1)
    config = public_config(CONFIG)
    if (config.get('LIDRADAR_ENV') != 'staging'
            or config.get('COMPOSE_PROJECT_NAME') != 'lidradar-staging'
            or config.get('LIDRADAR_DOMAIN') != 'stage.app-lid-radar.ru'):
        raise DeployError('Not the LidRadar staging environment')
    for repo in (BACKEND, FRONTEND):
        if command('git', '-C', str(repo), 'status', '--porcelain'):
            raise DeployError('Release checkout has uncommitted changes')
    backend = command('git', '-C', str(BACKEND), 'rev-parse', 'HEAD')
    if not SHA.fullmatch(backend):
        raise DeployError('Invalid current backend revision')
    # A frontend push never advances the backend or its migrations.
    version = config.get('LIDRADAR_VERSION', '')
    if not re.fullmatch(re.escape(backend[:12]) + r'(?:-w[0-9a-f]{8})?', version):
        raise DeployError('Backend checkout does not match the deployed release tag')
    command('git', '-C', str(FRONTEND), 'fetch', '--quiet', 'origin')
    current_stage = command('git', '-C', str(FRONTEND), 'rev-parse', 'origin/stage')
    if current_stage != sha:
        raise DeployError('Superseded CI: requested SHA is not the current origin/stage')
    command('git', '-C', str(FRONTEND), 'merge-base', '--is-ancestor', 'HEAD', sha)
    tag = f'{backend[:12]}-w{sha[:8]}'
    common = [str(BACKEND / 'scripts/release.sh'), '--web-dir', str(FRONTEND),
              '--branch', 'stage', '--commit', backend, '--web-commit', sha,
              '--expect-tag', tag]
    return common


def deploy(request):
    args = prepare(request)
    LOGS.mkdir(mode=0o700, parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    log_path = LOGS / f'stage-web-{stamp}-{args[-1]}.log'
    # O_EXCL prevents following existing paths; no credentials are passed to argv.
    fd = os.open(log_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as log:
        planned = subprocess.run(args + ['--dry-run'], stdin=subprocess.DEVNULL,
                                 stdout=log, stderr=subprocess.STDOUT, check=False)
        if planned.returncode:
            code = planned.returncode
        else:
            # Keep the release alive if the SSH connection or Actions runner ends.
            child = subprocess.Popen(args + ['--yes'], stdin=subprocess.DEVNULL,
                                     stdout=log, stderr=subprocess.STDOUT,
                                     start_new_session=True)
            code = child.wait()
    print(log_path.read_text(), end='', flush=True)
    print(f'Stage release exit={code}; log={log_path}', flush=True)
    return code


def main():
    if len(sys.argv) != 1:
        print('No CLI arguments accepted', file=sys.stderr)
        return 2
    try:
        return deploy(os.environ.get('SSH_ORIGINAL_COMMAND', ''))
    except (DeployError, OSError) as error:
        print(f'Stage deployment refused: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
