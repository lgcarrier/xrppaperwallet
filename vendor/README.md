# Local runtime dependencies

The application loads these files directly using relative paths. No package
installation, CDN, remote font, analytics service, or build step is needed to
generate or print a wallet. Keep scripts byte-for-byte identical to their
published artifacts so reviewers can reproduce the checks below.

| Library | Local file | Source | License |
| --- | --- | --- | --- |
| xrpl.js 5.3.0 | `xrpl/5.3.0/xrpl-latest-min.js` | `package/build/xrpl-latest-min.js` in the [npm archive](https://registry.npmjs.org/xrpl/-/xrpl-5.3.0.tgz) | ISC; adjacent `LICENSE` from the archive |
| qrcode-generator 2.0.4 | `qrcode-generator/2.0.4/qrcode.js` | `package/dist/qrcode.js` in the [npm archive](https://registry.npmjs.org/qrcode-generator/-/qrcode-generator-2.0.4.tgz) | MIT; adjacent `LICENSE` from [upstream commit 83b7e8f](https://github.com/kazuhikoarase/qrcode-generator/blob/83b7e8fe3fddd3b0368dbafd6ce56995bd25e3c8/LICENSE), the npm release's `gitHead` |

Both npm archives were verified against their published `dist.integrity` before
extracting the scripts. The QR package does not contain a standalone license
file, so its license was retrieved from the exact upstream commit above. The
scripts' original copyright notices are retained. Existing XRP branding assets
remain in `ripple/` and `ripple_logos/`.

## Verify checked-in files

From the repository root on macOS:

```sh
shasum -a 256 -c vendor/SHA256SUMS
```

On systems with GNU coreutils, `sha256sum -c vendor/SHA256SUMS` is equivalent.

## Reproduce archive verification

The following read-only comparison requires Python 3 and an internet connection.
Run it from the repository root, before disconnecting and generating real keys.
It checks the release metadata, the pinned archive integrity, and exact bytes
of the vendored scripts and licenses. A checksum confirms artifact identity;
it is not an independent security audit of an upstream release.

```sh
python3 - <<'PY'
import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile
from urllib.request import urlopen

releases = [
    (
        "xrpl", "5.3.0",
        "sha512-sdyi7qqJ13U+nMllHgxJTWbQm/Tk8uzhBmeTKwhI9WxkHuekPfbvJ3BDopXO2vMfsty7lBja0ACSHEUKLz3F/w==",
        "package/build/xrpl-latest-min.js",
        "vendor/xrpl/5.3.0/xrpl-latest-min.js",
    ),
    (
        "qrcode-generator", "2.0.4",
        "sha512-mZSiP6RnbHl4xL2Ap5HfkjLnmxfKcPWpWe/c+5XxCuetEenqmNFf1FH/ftXPCtFG5/TDobjsjz6sSNL0Sr8Z9g==",
        "package/dist/qrcode.js",
        "vendor/qrcode-generator/2.0.4/qrcode.js",
    ),
]
for name, version, integrity, member, local in releases:
    metadata = json.load(urlopen(f"https://registry.npmjs.org/{name}/{version}"))
    assert metadata["dist"]["integrity"] == integrity
    archive = urlopen(f"https://registry.npmjs.org/{name}/-/{name}-{version}.tgz").read()
    algorithm, expected = integrity.split("-", 1)
    actual = base64.b64encode(hashlib.new(algorithm, archive).digest()).decode()
    assert actual == expected, f"{name}: archive integrity mismatch"
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:gz") as package:
        assert package.extractfile(member).read() == Path(local).read_bytes()
        if name == "xrpl":
            assert package.extractfile("package/LICENSE").read() == Path("vendor/xrpl/5.3.0/LICENSE").read_bytes()
        else:
            assert metadata["gitHead"] == "83b7e8fe3fddd3b0368dbafd6ce56995bd25e3c8"
    print(f"{name}@{version}: verified")

license_url = "https://raw.githubusercontent.com/kazuhikoarase/qrcode-generator/83b7e8fe3fddd3b0368dbafd6ce56995bd25e3c8/LICENSE"
assert urlopen(license_url).read() == Path("vendor/qrcode-generator/2.0.4/LICENSE").read_bytes()
print("QR generator license: verified")
PY
```

Development-only test dependencies are pinned separately in `package-lock.json`
and are never loaded by `index.html`.
