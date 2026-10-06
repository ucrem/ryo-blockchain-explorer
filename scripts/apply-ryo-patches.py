#!/usr/bin/env python3
"""Apply only exact reviewed patch combinations to the pinned native SDK."""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile


def apply_reviewed_patches(source: Path) -> None:
    root = Path(__file__).resolve().parent.parent
    core = source.resolve(strict=True)
    pin = (root / 'scripts/ryo-core-revision.txt').read_text().strip()

    def git(*args, env=None):
        return subprocess.run(['git', '--no-optional-locks', '-C', str(core), *args], env=env,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True).stdout

    if Path(git('rev-parse', '--show-toplevel').decode().strip()).resolve() != core:
        raise ValueError('Provide the SDK checkout root, not a subdirectory.')
    if git('rev-parse', 'HEAD').decode().strip() != pin:
        raise ValueError(f'Ryo checkout must match {pin}; no source changes made.')
    if git('diff', '--cached', '--no-ext-diff', '--binary'):
        raise ValueError('Refusing to modify a core checkout with staged changes.')
    patches = [root / 'scripts/patches' / name for name in
               ('ryo-ubuntu24.patch', 'ryo-point-identity.patch', 'ryo-native-warnings.patch')]
    diff_args = ('--no-ext-diff', '--no-textconv', '--no-color', '--binary')
    current = git('diff', *diff_args)
    accepted = None
    with tempfile.TemporaryDirectory(prefix='ryo-reviewed-patches-') as scratch:
        env = os.environ.copy()
        env['GIT_INDEX_FILE'] = str(Path(scratch) / 'index')
        objects = Path(scratch) / 'objects'
        objects.mkdir()
        env['GIT_OBJECT_DIRECTORY'] = str(objects)
        native_objects = Path(git('rev-parse', '--git-path', 'objects').decode().strip())
        if not native_objects.is_absolute():
            native_objects = core / native_objects
        env['GIT_ALTERNATE_OBJECT_DIRECTORIES'] = str(native_objects)
        # Typical current/upgrade states first; the other exact subsets are safe
        # too. All candidate mutations use this disposable index, never the SDK's.
        for mask in (7, 3, 1, 0, 6, 5, 4, 2):
            git('read-tree', 'HEAD', env=env)
            selected = [str(p) for i, p in enumerate(patches) if mask & (1 << i)]
            if selected:
                git('-c', 'core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol',
                    'apply', '--cached', *selected, env=env)
            expected = git('diff', '--cached', *diff_args, env=env)
            if current == expected:
                accepted = mask
                break
    if accepted is None:
        raise ValueError('Unexpected Ryo source modifications; refusing to overwrite them.')
    missing = [str(p) for i, p in enumerate(patches) if not accepted & (1 << i)]
    if missing:
        git('-c', 'core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol',
            'apply', '--check', *missing)
        git('-c', 'core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol',
            'apply', *missing)
        print('Applied missing reviewed compatibility, identity and warning patches.')
    else:
        print('All reviewed native SDK patches are already applied.')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    args = parser.parse_args()
    try:
        apply_reviewed_patches(args.source)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.exit(1, f'{error}\n')


if __name__ == '__main__':
    main()
