#!/usr/bin/env python3
"""Check reviewed SDK upgrades and refusal/preservation of unrelated edits."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    pin = (root / 'scripts/ryo-core-revision.txt').read_text().strip()
    patches = [root / 'scripts/patches' / name for name in
               ('ryo-ubuntu24.patch', 'ryo-point-identity.patch', 'ryo-native-warnings.patch')]
    git_args = ['git', '--no-optional-locks']

    def git(core, *args):
        return subprocess.check_output(git_args + ['-C', str(core), *args], stderr=subprocess.PIPE)

    with tempfile.TemporaryDirectory(prefix='ryo-patch-guard-') as scratch:
        def clone(name, mask):
            core = Path(scratch) / name
            subprocess.run(git_args + ['clone', '--quiet', '--shared', '--no-checkout', str(args.source), str(core)], check=True)
            git(core, 'checkout', '--quiet', '--detach', pin)
            chosen = [str(p) for i, p in enumerate(patches) if mask & (1 << i)]
            if chosen:
                git(core, '-c', 'core.whitespace=cr-at-eol', 'apply', *chosen)
            return core

        def apply(core):
            return subprocess.run([sys.executable, str(root / 'scripts/apply-ryo-patches.py'), str(core)],
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        def assert_refused(core, argument=None):
            before = git(core, 'diff', '--binary')
            staged = git(core, 'diff', '--cached', '--binary')
            head = git(core, 'rev-parse', 'HEAD')
            index = (core / '.git/index').read_bytes()
            objects = sorted(str(p.relative_to(core / '.git/objects')) for p in (core / '.git/objects').rglob('*'))
            result = apply(argument or core)
            assert result.returncode != 0, 'Unexpectedly accepted unrelated SDK changes.'
            assert before == git(core, 'diff', '--binary') and staged == git(core, 'diff', '--cached', '--binary')
            assert head == git(core, 'rev-parse', 'HEAD') and index == (core / '.git/index').read_bytes()
            assert objects == sorted(str(p.relative_to(core / '.git/objects')) for p in (core / '.git/objects').rglob('*'))

        reference = clone('all-reviewed', 7)
        expected = git(reference, 'diff', '--binary')
        for mask in range(8):
            core = clone(f'reviewed-subset-{mask}', mask)
            result = apply(core)
            assert result.returncode == 0, result.stderr.decode(errors='replace')
            assert git(core, 'diff', '--binary') == expected, f'Incomplete upgrade from subset {mask}.'
            assert not git(core, 'diff', '--cached', '--binary'), 'Helper staged SDK changes.'
            assert git(core, 'rev-parse', 'HEAD').decode().strip() == pin
            assert apply(core).returncode == 0, 'Already applied patches must remain accepted.'
            print(f'Reviewed patch subset {mask}: exact upgrade and repeat passed.')

        foreign = clone('unrelated-edit', 7)
        edited = foreign / 'src/common/util.cpp'
        edited.write_bytes(edited.read_bytes() + b'\n// unrelated operator edit\n')
        assert_refused(foreign)
        staged = clone('staged-edit', 7)
        edited = staged / 'src/common/util.cpp'
        edited.write_bytes(edited.read_bytes() + b'\n// staged operator edit\n')
        git(staged, 'add', 'src/common/util.cpp')
        assert_refused(staged)
        wrong_pin = clone('different-pin', 0)
        git(wrong_pin, 'checkout', '--quiet', '--detach', 'HEAD^')
        assert_refused(wrong_pin)
        nested = clone('nested-directory', 7)
        assert_refused(nested, nested / 'src')
        print('Unrelated edits, staged edits, different pin and nested path: rejected and preserved.')

        # Record configure arguments only; real compilation is a separate gate.
        upgrade = clone('cached-compiler-flags', 3)
        cache = upgrade / 'build/release/CMakeCache.txt'
        cache.parent.mkdir(parents=True)
        legacy_flags = ('-DOPERATOR_FLAG=1 -Wno-error=deprecated-copy '
                        '-Wno-error=misleading-indentation -DOPERATOR_TEXT="left right"')
        cache.write_text('CMAKE_CXX_FLAGS:STRING=' + legacy_flags + '\n')
        stub_dir = Path(scratch) / 'record-cmake'
        stub_dir.mkdir()
        stub = stub_dir / 'cmake'
        stub.write_text('#!' + sys.executable + '\n'
                        'import json,os,sys\n'
                        'with open(os.environ["RYO_TEST_CMAKE_RECORD"], "a") as out:\n'
                        '    out.write(json.dumps(sys.argv[1:]) + "\\n")\n')
        stub.chmod(0o755)
        record = Path(scratch) / 'cmake-arguments.jsonl'
        env = os.environ.copy()
        env['PATH'] = str(stub_dir) + os.pathsep + env['PATH']
        env['RYO_TEST_CMAKE_RECORD'] = str(record)
        subprocess.run(['bash', str(root / 'scripts/build-ryo-core.sh'), str(upgrade), '2'],
                       env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        configure = json.loads(record.read_text().splitlines()[0])
        flags = next(a for a in configure if a.startswith('-DCMAKE_CXX_FLAGS='))
        assert '-Wno-error=deprecated-copy' not in flags and '-Wno-error=misleading-indentation' not in flags
        assert '-DOPERATOR_FLAG=1' in flags and '-DOPERATOR_TEXT="left right"' in flags
        assert git(upgrade, 'diff', '--binary') == expected
        print('Cached legacy compiler exemptions removed; unrelated operator flags preserved.')


if __name__ == '__main__':
    main()
