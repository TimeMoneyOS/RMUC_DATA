"""生成可放到 GitHub Pages 子路径下的完整静态回放站点。"""
import json
import shutil
from pathlib import Path
from server import ROOT, query, replay

def build():
    destination = ROOT / 'site'
    destination.mkdir(exist_ok=True)
    (destination / 'data').mkdir(exist_ok=True)
    shutil.copytree(ROOT / 'assets', destination / 'assets', dirs_exist_ok=True)
    shutil.copytree(ROOT / 'frontend', destination / 'frontend', dirs_exist_ok=True)
    html = (ROOT / 'frontend/index.html').read_text(encoding='utf-8-sig')
    html = html.replace('/frontend/', 'frontend/')
    (destination / 'index.html').write_text(html, encoding='utf-8')
    app = (ROOT / 'frontend/app.js').read_text(encoding='utf-8')
    app = app.replace('/assets/', 'assets/')
    app = app.replace('`/api/replay?id=${id}`', '`data/${id}.json`')
    app = app.replace("'/api/matches'", "'data/matches.json'")
    (destination / 'frontend/app.js').write_text(app, encoding='utf-8')
    matches = query('SELECT * FROM matches ORDER BY 开始时间')
    (destination / 'data/matches.json').write_text(json.dumps(matches, ensure_ascii=False), encoding='utf-8')
    for i, match in enumerate(matches, 1):
        game_id = match['game_id']
        # 去除 JSON 空白，保持所有事件及字段不变。
        payload = json.loads(replay(game_id))
        (destination / f'data/{game_id}.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        if i % 100 == 0:
            print(f'Exported {i}/{len(matches)}', flush=True)
    (destination / '.nojekyll').touch()
    total = sum(p.stat().st_size for p in destination.rglob('*') if p.is_file())
    print(f'Static site: {len(matches)} games, {total / 1024**2:.1f} MiB; {destination}', flush=True)

if __name__ == '__main__':
    build()
