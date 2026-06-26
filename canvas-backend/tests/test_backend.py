import json
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

import main


class IsolatedBackendTest(unittest.TestCase):
    def setUp(self):
        self._tmpdir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self._old_data_dir = main.DATA_DIR
        self._old_db_path = main.DB_PATH
        root = Path(self._tmpdir.name)
        main.DATA_DIR = root / "data"
        main.DB_PATH = main.DATA_DIR / "agentflow.db"
        main.rate_buckets.clear()
        main.init_db()
        self.client = TestClient(main.app)

    def tearDown(self):
        main.DATA_DIR = self._old_data_dir
        main.DB_PATH = self._old_db_path
        main.rate_buckets.clear()
        self._tmpdir.cleanup()

    def _register(self, email="alice@example.com"):
        response = self.client.post(
            "/api/auth/register",
            json={"email": email, "password": "strong-pass"},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        return payload["token"], {"Authorization": f"Bearer {payload['token']}"}

    def test_auth_project_template_and_log_flow(self):
        token, headers = self._register()
        self.assertTrue(token)

        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json()["target_enterprise_score"], 98)

        readiness = self.client.get("/api/readiness")
        self.assertEqual(readiness.status_code, 200)
        self.assertTrue(readiness.json()["ready"])

        scorecard = self.client.get("/api/scorecard")
        self.assertEqual(scorecard.status_code, 200)
        self.assertEqual(scorecard.json()["score"], 98)

        me = self.client.get("/api/me", headers=headers)
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["email"], "alice@example.com")

        projects = self.client.get("/api/projects", headers=headers)
        self.assertEqual(projects.status_code, 200)
        self.assertEqual(projects.json()[0]["name"], "默认项目")

        templates = self.client.get("/api/templates", headers=headers)
        self.assertEqual(templates.status_code, 200)
        self.assertGreaterEqual(len(templates.json()), 4)

        logs = self.client.get("/api/logs", headers=headers)
        self.assertEqual(logs.status_code, 200)
        self.assertTrue(any(item["path"] == "/api/me" for item in logs.json()))

        events = self.client.get("/api/governance/events", headers=headers)
        self.assertEqual(events.status_code, 200)
        event_types = {item["event_type"] for item in events.json()["events"]}
        self.assertIn("auth.register", event_types)

    def test_canvas_save_versions_and_owner_boundary(self):
        _, headers = self._register()
        project_id = self.client.get("/api/projects", headers=headers).json()[0]["id"]
        canvas_payload = {
            "project_id": project_id,
            "title": "Release Plan",
            "prompt": "设计产品上线 agent 工作流",
            "summary": "从需求到发布复盘的执行拓扑。",
            "nodes": [
                {"id": "input", "label": "需求澄清", "type": "Input", "description": "明确目标和约束。"},
                {"id": "plan", "label": "方案规划", "type": "Planning", "description": "拆解研发和测试计划。"},
            ],
            "edges": [{"source": "input", "target": "plan", "label": "进入规划"}],
        }

        saved = self.client.post("/api/canvases", json=canvas_payload, headers=headers)
        self.assertEqual(saved.status_code, 200)
        canvas_id = saved.json()["id"]

        versions = self.client.get(f"/api/canvases/{canvas_id}/versions", headers=headers)
        self.assertEqual(versions.status_code, 200)
        self.assertEqual(versions.json()[0]["version"], 1)

        events = self.client.get("/api/governance/events", headers=headers)
        self.assertEqual(events.status_code, 200)
        event_types = {item["event_type"] for item in events.json()["events"]}
        self.assertIn("canvas.saved", event_types)

        _, other_headers = self._register("bob@example.com")
        forbidden = self.client.get(f"/api/canvases/{canvas_id}", headers=other_headers)
        self.assertEqual(forbidden.status_code, 404)


class TopologyParsingTest(unittest.TestCase):
    def test_parse_topology_response_accepts_fenced_json(self):
        content = """```json
{
  "summary": "先调研，再执行。",
  "nodes": [
    {"id": "research", "label": "调研", "type": "Research", "description": "收集输入。"},
    {"id": "execute", "label": "执行", "type": "Execution", "description": "完成任务。"}
  ],
  "edges": [
    {"source": "research", "target": "execute", "label": "交付输入"}
  ]
}
```"""

        topology = main.parse_topology_response(content)

        self.assertEqual(topology.summary, "先调研，再执行。")
        self.assertEqual(len(topology.nodes), 2)
        self.assertEqual(topology.edges[0].source, "research")

    def test_parse_topology_response_rejects_invalid_json(self):
        with self.assertRaises(ValueError):
            main.parse_topology_response(json.dumps({"summary": "缺少 nodes 和 edges"}))


if __name__ == "__main__":
    unittest.main()
