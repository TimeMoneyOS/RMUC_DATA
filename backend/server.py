"""只读比赛服务；直接运行，无第三方依赖。"""
import json
import sqlite3
from functools import lru_cache
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
import argparse
from contextlib import closing

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT.parent / 'rmuc_2026_region_dataset/rmuc_2026_region_dataset.sqlite'

def query(sql, params=()):
    with closing(sqlite3.connect(DB.as_uri() + '?mode=ro', uri=True)) as conn:
        conn.row_factory = sqlite3.Row
        return [dict(row) for row in conn.execute(sql, params)]

@lru_cache(maxsize=3)
def replay(game_id):
    matches = query('SELECT * FROM matches WHERE game_id=?', (game_id,))
    if not matches:
        raise ValueError('比赛不存在')
    states = query('SELECT * FROM timeseries WHERE game_id=? ORDER BY 时刻秒,robot_id', (game_id,))
    robots = {}
    for row in states:
        key = str(row['robot_id'])
        if key not in robots:
            robots[key] = {'id': row['robot_id'], 'type': row['机器人类型'], 'team': row['阵营'], 'frames': []}
        robots[key]['frames'].append([row[k] for k in ['时刻秒','x','y','枪口朝向','当前血量','最大血量','队伍剩余金币','累计17mm发弹','累计42mm发弹','底盘功率','小热量','大热量','是否易伤']])
    events = query('SELECT 时刻秒,事件类型,robot_id,机器人类型,阵营,类别,数值,备注,目标robot_id,目标类型 FROM events WHERE game_id=? ORDER BY 时刻秒', (game_id,))
    payload = {'match': matches[0], 'robots': list(robots.values()), 'events': events,
               'columns': ['time','x','y','heading','hp','maxHp','coins','ammo17','ammo42','power','heat17','heat42','vulnerable']}
    return json.dumps(payload, ensure_ascii=False, allow_nan=False).encode('utf-8')

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        url = urlsplit(self.path)
        try:
            if url.path == '/api/matches':
                body = json.dumps(query('SELECT * FROM matches ORDER BY 开始时间'), ensure_ascii=False).encode('utf-8')
            elif url.path == '/api/replay':
                body = replay(int(parse_qs(url.query).get('id', [''])[0]))
            else:
                if url.path == '/':
                    self.path = '/frontend/index.html'
                return super().do_GET()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (ValueError, sqlite3.Error) as exc:
            self.send_error(400, str(exc))
        except (BrokenPipeError, ConnectionResetError):
            pass

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    print(f'回放地址：http://127.0.0.1:{args.port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
