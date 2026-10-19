"""Build MapTool packages, or verify their contents against source."""
from pathlib import Path
import argparse
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = {'STA2e': '.mtlib', 'STA2e-Remote': '.mtlib', 'STA2e-TokenTypes': '.mtprops'}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    for name, extension in PACKAGES.items():
        source = ROOT / 'src' / name
        files = {p.relative_to(source).as_posix(): p.read_bytes() for p in sorted(source.rglob('*')) if p.is_file()}
        if not files:
            raise SystemExit(f'No source found: {source}')
        package = ROOT / 'dist' / (name + extension)
        if args.check:
            with zipfile.ZipFile(package) as archive:
                actual = {i.filename: archive.read(i) for i in archive.infolist() if not i.is_dir()}
            if actual != files:
                raise SystemExit(f'{package.name} differs from source; run python tools/build.py')
            print(f'PASS {package.name}: {len(files)} files match source')
        else:
            package.parent.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(package, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
                for path, data in files.items():
                    info = zipfile.ZipInfo(path, date_time=(2020, 1, 1, 0, 0, 0))
                    info.compress_type = zipfile.ZIP_DEFLATED
                    info.external_attr = 0o644 << 16
                    archive.writestr(info, data)
            print(f'Built {package.name}')

if __name__ == '__main__':
    main()
