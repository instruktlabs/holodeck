"""python -I -m unittest discover -s Tools/tests -v

Black-box tests of validate_bundle_meta.py against the fixture projects in
fixtures/bundle_meta (good, missing_meta, reminted_guid). Each run copies a
fixture to a temp dir so the surrounding repository's git state is not involved.
"""
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
TOOL = HERE.parent / 'validate_bundle_meta.py'
FIXTURES = HERE / 'fixtures' / 'bundle_meta'
GLB_GUID = 'f1f1f1f1f1f1f1f10000000000000001'
REMINTED = 'f1f1f1f1f1f1f1f100000000000000ee'


def run(project, *args):
    p = subprocess.run([sys.executable, '-I', str(TOOL), '--project', str(project), *args], capture_output=True, text=True)
    return p.returncode, json.loads(p.stdout)


class BundleMetaGate(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix='bundle-meta-'))

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def copy(self, name):
        target = self.tmp / name
        shutil.copytree(FIXTURES / name, target)
        return target

    def receipt_from(self, project):
        inputs = {p.relative_to(project).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in (project / 'Assets').rglob('*') if p.is_file()}
        path = self.tmp / f'{project.name}-inputs.json'
        path.write_text(json.dumps({'inputs': inputs}), encoding='utf-8')
        return path

    def test_good_fixture_passes_on_disk(self):
        code, r = run(self.copy('good'), '--allow-uncommitted')
        self.assertEqual((code, r['status']), (0, 'passed'), r['errors'])
        self.assertEqual(r['bundleMetas'], 3)
        self.assertEqual(r['resolved']['project'], 1)
        self.assertEqual(r['resolved']['known'], ['0000000000000000f000000000000000'])
        self.assertTrue(any('cannot prove' in w for w in r['warnings']))

    def test_uncommitted_is_an_error_by_default(self):
        code, r = run(self.copy('good'))
        self.assertEqual(code, 1)
        self.assertTrue(any('cannot prove .meta files are committed' in e for e in r['errors']))

    @unittest.skipUnless(shutil.which('git'), 'git unavailable')
    def test_untracked_meta_in_repository_fails(self):
        project = self.copy('good')
        subprocess.run(['git', 'init', '-q', str(project)], check=True)
        code, r = run(project)
        self.assertEqual(code, 1)
        self.assertTrue(any('3 bundle .meta file(s) not committed' in e and '(untracked)' in e for e in r['errors']), r['errors'])

    def test_missing_meta_fixture_fails(self):
        code, r = run(self.copy('missing_meta'), '--allow-uncommitted')
        self.assertEqual(code, 1)
        self.assertIn('missing .meta: Assets/CastleSliceBundle/fixture-a.glb', r['errors'])
        self.assertIn(GLB_GUID, r['unresolved'])

    def test_reminted_guid_fixture_fails_and_is_reported(self):
        good, reminted = self.copy('good'), self.copy('reminted_guid')
        code, r = run(reminted, '--allow-uncommitted', '--compare', str(good / 'Assets'), '--receipt', str(self.receipt_from(good)))
        self.assertEqual(code, 1)
        self.assertEqual(r['unresolved'], {GLB_GUID: ['Assets/CastleSliceGenerated/Fixture.unity']})
        self.assertEqual(r['compare']['divergentGuidIdentical'], 1)
        d = r['compare']['divergent'][0]
        self.assertEqual((d['asset'], d['guid'], d['other'][0]['guid']), ('Assets/CastleSliceBundle/fixture-a.glb', REMINTED, GLB_GUID))
        self.assertEqual(r['receipt']['mismatched'], ['Assets/CastleSliceBundle/fixture-a.glb.meta'])
        self.assertIn('receipt .meta hash mismatch: Assets/CastleSliceBundle/fixture-a.glb.meta', r['errors'])

    def test_matching_receipt_and_identical_copy_pass(self):
        good = self.copy('good')
        other = self.tmp / 'other'
        shutil.copytree(good, other)
        code, r = run(good, '--allow-uncommitted', '--compare', str(other / 'Assets'), '--receipt', str(self.receipt_from(good)))
        self.assertEqual(code, 0, r['errors'])
        self.assertEqual((r['compare']['divergentGuidIdentical'], r['receipt']['mismatched'], r['receipt']['missing']), (0, [], []))

    def test_duplicate_guid_and_bundle_hash_mismatch_fail(self):
        project = self.copy('good')
        meta = (project / 'Assets/CastleSliceBundle/fixture-a.glb.meta').read_text()
        (project / 'Assets/Copy.txt').write_text('copy\n')
        (project / 'Assets/Copy.txt.meta').write_text(meta)
        (project / 'Assets/CastleSliceBundle/slice.json').write_text('{"assets":[{"id":"fixture-a","file":"fixture-a.glb","sha256":"' + '0' * 64 + '"}]}\n')
        code, r = run(project, '--allow-uncommitted')
        self.assertEqual(code, 1)
        self.assertTrue(any(e.startswith(f'duplicate GUID {GLB_GUID}') for e in r['errors']), r['errors'])
        self.assertIn('Assets/CastleSliceBundle/slice.json asset hash mismatch: fixture-a.glb', r['errors'])

    def test_unknown_package_guid_needs_a_package_root(self):
        project = self.copy('good')
        package_guid = 'abcdefabcdefabcdefabcdefabcdef01'
        scene = project / 'Assets/CastleSliceGenerated/Fixture.unity'
        scene.write_text(scene.read_text() + f'  m_Shader: {{fileID: 4800000, guid: {package_guid}, type: 3}}\n')
        code, r = run(project, '--allow-uncommitted')
        self.assertEqual(code, 1)
        self.assertIn(package_guid, r['unresolved'])
        root = self.tmp / 'package'
        root.mkdir()
        (root / 'Lit.shader.meta').write_text(f'fileFormatVersion: 2\nguid: {package_guid}\n')
        code, r = run(project, '--allow-uncommitted', '--package-root', str(root))
        self.assertEqual(code, 0, r['errors'])
        self.assertEqual(r['resolved']['packageRoot'], [package_guid])


if __name__ == '__main__':
    unittest.main()
