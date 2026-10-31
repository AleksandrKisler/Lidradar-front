import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch, Mock

spec = importlib.util.spec_from_file_location('stage_deploy', Path(__file__).resolve().parents[1] / 'stage-deploy.py')
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)
REAL_CONFIG = deploy.public_config
BACK = 'a' * 40
WEB = 'b' * 40
VALID = {'LIDRADAR_ENV': 'staging', 'COMPOSE_PROJECT_NAME': 'lidradar-staging',
         'LIDRADAR_DOMAIN': 'stage.app-lid-radar.ru', 'LIDRADAR_VERSION': BACK[:12]}


class StageDeployTests(unittest.TestCase):
    def setUp(self):
        self.cfg = patch.object(deploy, 'public_config', return_value=dict(VALID)).start()
        self.cmd = patch.object(deploy, 'command', side_effect=self.command).start()
        self.addCleanup(patch.stopall)

    def command(self, *args):
        if args[-1] == '--porcelain':
            return ''
        if args[-2:] == ('rev-parse', 'HEAD'):
            return BACK
        if args[-2:] == ('rev-parse', 'origin/stage'):
            return WEB
        return ''

    def test_request_is_sha_only_no_shell_or_extra_arguments(self):
        for request in ('', 'status', f'deploy-web {WEB}; id', f'deploy-web {WEB}\n',
                        'deploy-web stage', 'deploy-web ' + 'b' * 8, f'deploy-web {WEB} extra'):
            with self.subTest(request=request), self.assertRaises(deploy.DeployError):
                deploy.prepare(request)
        self.cmd.assert_not_called()
        self.cfg.assert_not_called()

    def test_only_named_staging_stack_is_accepted(self):
        for key, bad in [('LIDRADAR_ENV', 'production'), ('COMPOSE_PROJECT_NAME', 'lidradar'),
                         ('LIDRADAR_DOMAIN', 'app-lid-radar.ru')]:
            with self.subTest(key=key):
                self.cfg.return_value = {**VALID, key: bad}
                with self.assertRaises(deploy.DeployError):
                    deploy.prepare(f'deploy-web {WEB}')
        self.cmd.assert_not_called()

    def test_dirty_checkout_denied_before_fetch(self):
        self.cmd.side_effect = lambda *args: ' M source.ts' if args[-1] == '--porcelain' else ''
        with self.assertRaises(deploy.DeployError):
            deploy.prepare(f'deploy-web {WEB}')
        self.assertEqual(self.cmd.call_count, 1)

    def test_backend_is_pinned_and_must_match_running_tag(self):
        self.cfg.return_value = {**VALID, 'LIDRADAR_VERSION': 'c' * 12}
        with self.assertRaises(deploy.DeployError):
            deploy.prepare(f'deploy-web {WEB}')
        self.assertFalse(any('fetch' in call.args for call in self.cmd.call_args_list))

    def test_superseded_successful_ci_cannot_deploy_old_stage_sha(self):
        with self.assertRaises(deploy.DeployError):
            deploy.prepare('deploy-web ' + 'c' * 40)

    def test_non_fast_forward_denied(self):
        def fake(*args):
            if 'merge-base' in args:
                raise deploy.DeployError('not an ancestor')
            return self.command(*args)
        self.cmd.side_effect = fake
        with self.assertRaises(deploy.DeployError):
            deploy.prepare(f'deploy-web {WEB}')

    def test_exact_backend_and_frontend_commit_and_tag_are_released(self):
        self.cfg.return_value = {**VALID, 'LIDRADAR_VERSION': BACK[:12] + '-w' + 'c' * 8}
        args = deploy.prepare(f'deploy-web {WEB}')
        self.assertEqual(args[args.index('--branch') + 1], 'stage')
        self.assertEqual(args[args.index('--commit') + 1], BACK)
        self.assertEqual(args[args.index('--web-commit') + 1], WEB)
        self.assertEqual(args[args.index('--expect-tag') + 1], BACK[:12] + '-w' + WEB[:8])
        self.assertNotIn('--allow-dirty', args)

    def test_last_config_value_wins_and_secrets_are_not_returned(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'config'
            p.write_text('LIDRADAR_ENV=production\nLIDRADAR_ENV="staging"\nTOKEN=not-a-real-secret\n')
            self.assertEqual(REAL_CONFIG(p), {'LIDRADAR_ENV': 'staging'})

    def test_failed_plan_never_starts_release(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(deploy, 'LOGS', Path(tmp)), \
             patch.object(deploy.subprocess, 'run', return_value=Mock(returncode=2)), \
             patch.object(deploy.subprocess, 'Popen') as start, patch('builtins.print'):
            self.assertEqual(deploy.deploy(f'deploy-web {WEB}'), 2)
            start.assert_not_called()

    def test_remote_release_survives_disconnect_and_propagates_smoke_failure(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(deploy, 'LOGS', Path(tmp)), \
             patch.object(deploy.subprocess, 'run', return_value=Mock(returncode=0)) as plan, \
             patch.object(deploy.subprocess, 'Popen') as start, patch('builtins.print'):
            start.return_value.wait.return_value = 1
            self.assertEqual(deploy.deploy(f'deploy-web {WEB}'), 1)
            self.assertIn('--dry-run', plan.call_args.args[0])
            self.assertIn('--yes', start.call_args.args[0])
            self.assertTrue(start.call_args.kwargs['start_new_session'])
            self.assertEqual(start.call_args.kwargs['stdin'], subprocess.DEVNULL)


if __name__ == '__main__':
    unittest.main()
