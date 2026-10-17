"""Fetch raw inputs into data/raw/. Usage: python download.py [eia] [storm] [osha]  (no args = all)"""
import re, sys, zipfile, io
from pathlib import Path
import requests

RAW = Path(__file__).parent / 'data' / 'raw'
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/126 Safari/537.36'}
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


def fetch(url, dest):
    with requests.get(url, headers=UA, stream=True, timeout=120) as r:
        r.raise_for_status()
        with open(dest, 'wb') as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    print(f'saved {dest.name} ({dest.stat().st_size >> 20} MB)', flush=True)


def eia():
    # The listing links months that are not published yet (they redirect to an HTML page), so take the first real XLSX.
    base = 'https://www.eia.gov'
    page = requests.get(base + '/electricity/data/eia860m/', headers=UA, timeout=60).text
    for href in dict.fromkeys(re.findall(r'href="(/electricity/data/eia860m/[^"]*generator\d{4}\.xlsx)"', page)):
        r = requests.get(base + href, headers=UA, timeout=120)
        if r.ok and r.headers.get('content-type', '').startswith(XLSX):
            (RAW / 'eia860m.xlsx').write_bytes(r.content)
            print(f'saved eia860m.xlsx from {href}', flush=True)
            return
    sys.exit('no EIA-860M xlsx found')


def storm():
    base = 'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles/'
    listing = requests.get(base, headers=UA, timeout=60).text
    for year in range(2016, 2025):
        name = sorted(set(re.findall(rf'StormEvents_details-ftp_v1\.0_d{year}_c\d+\.csv\.gz', listing)))[-1]
        dest = RAW / name
        if not dest.exists():
            fetch(base + name, dest)


def osha():
    r = requests.get('https://www.osha.gov/sites/default/files/January2015toDecember2024.zip', headers=UA, timeout=300)
    r.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        name = next(n for n in z.namelist() if n.lower().endswith('.csv'))
        (RAW / 'severeinjury.csv').write_bytes(z.read(name))
    print(f'saved severeinjury.csv from {name}', flush=True)


if __name__ == '__main__':
    RAW.mkdir(parents=True, exist_ok=True)
    for step in sys.argv[1:] or ['eia', 'storm', 'osha']:
        globals()[step]()
