"""用独立 SQL 验证导出的回放数据。"""
import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.server import query, replay

class ReplayDataTest(unittest.TestCase):
    def test_regions(self):
        self.assertEqual(len(query('SELECT * FROM matches')), 613)

    def test_sample_and_event_count(self):
        game = 1779323658229
        data = json.loads(replay(game))
        self.assertEqual(len(data['robots']), 16)
        robot = next(r for r in data['robots'] if r['id'] == 3)
        row = query('SELECT * FROM timeseries WHERE game_id=? AND robot_id=3 ORDER BY 时刻秒 LIMIT 1', (game,))[0]
        self.assertEqual(robot['frames'][0][:3], [row['时刻秒'], row['x'], row['y']])
        self.assertEqual(len(data['events']), query('SELECT COUNT(*) n FROM events WHERE game_id=?', (game,))[0]['n'])
        self.assertTrue(all(e['时刻秒'] >= 0 for e in data['events']))

    def test_missing_match(self):
        with self.assertRaises(ValueError):
            replay(-1)

if __name__ == '__main__':
    unittest.main()
