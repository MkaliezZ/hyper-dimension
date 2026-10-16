import sys
import unittest
import ast
import json
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from dispatch_order import validate_dispatch_order


def job(task_id, dependencies=None):
    return {'id': task_id, 'npcId': 5, 'status': 'queued', 'dependsOn': dependencies or []}


class DispatchOrderTests(unittest.TestCase):
    def check(self, dependencies, rows=None, proposed=None, manual=True):
        return validate_dispatch_order({'npcId': 5, 'dependsOn': dependencies},
                                       {'taskBoard': rows or []}, proposed or [], manual)

    def test_manual_chain_uses_tool_returned_ids_and_transitive_predecessors(self):
        self.assertTrue(self.check(['second'], proposed=[job('first'), job('second', ['first'])])['ok'])

    def test_saved_chain_can_be_extended_without_replacing_current_work(self):
        self.assertTrue(self.check(['second'], rows=[job('first'), job('second', ['first'])])['ok'])

    def test_unordered_or_skipped_work_is_rejected(self):
        for dependencies in [[], ['first']]:
            self.assertFalse(self.check(dependencies, rows=[job('first'), job('second', ['first'])])['ok'])

    def test_unknown_malformed_and_fabricated_dependencies_are_rejected(self):
        for dependencies in [['missing'], 'first', [1], ['../first'], ['x'] * 21]:
            self.assertFalse(self.check(dependencies)['ok'])

    def test_manual_queue_has_four_task_limit(self):
        rows = [job('first'), job('second', ['first']), job('third', ['second']), job('fourth', ['third'])]
        self.assertFalse(self.check(['fourth'], rows=rows)['ok'])

    def test_automatic_cadence_does_not_gain_queues(self):
        self.assertFalse(self.check(['first'], rows=[job('first')], manual=False)['ok'])
        self.assertFalse(self.check([], proposed=[job('first')], manual=False)['ok'])
        self.assertTrue(self.check([], manual=False)['ok'])

    def test_missing_active_assignment_in_trimmed_observation_is_not_overwritten(self):
        result = validate_dispatch_order({'npcId': 5}, {'residents': [{'id': 5, 'assignment': {'id': 'omitted'}}]}, [], True)
        self.assertFalse(result['ok'])

    def test_duplicate_dependencies_are_normalized(self):
        result = self.check(['second', 'second'], rows=[job('first'), job('second', ['first'])])
        self.assertTrue(result['ok'])
        self.assertEqual(result['dependsOn'], ['second'])

    def test_cyclic_legacy_dependencies_cannot_accept_more_work(self):
        self.assertFalse(self.check(['second'], rows=[job('first', ['second']), job('second', ['first'])])['ok'])

    def test_actual_worker_dispatch_keeps_returned_dependency_ids(self):
        tree = ast.parse((Path(__file__).resolve().parents[1] / 'server/hermes_worker.py').read_text(encoding='utf8'))
        dispatch = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'dispatch')
        namespace = {'json': json, 'uuid': uuid, 'validate_dispatch_order': validate_dispatch_order,
                     'current': {'materials': [{'id': 'wood', 'source': 'forest'}]},
                     'commands': [], 'plans': [], 'parties': [], 'recruitments': [], 'manual': True}
        exec(compile(ast.Module(body=[dispatch], type_ignores=[]), '<actual-worker-dispatch>', 'exec'), namespace)
        args = {'npcId': 5, 'goal': 'forest', 'resource': 'wood', 'intent': '顺序采集', 'quantity': 2}
        first = json.loads(namespace['dispatch'](args))
        second = json.loads(namespace['dispatch']({**args, 'dependsOn': [first['command']['id']]}))
        self.assertTrue(second['accepted'])
        self.assertEqual(second['command']['dependsOn'], [first['command']['id']])
        self.assertFalse(json.loads(namespace['dispatch'](args))['accepted'])

    def test_actual_tool_schema_exposes_explicit_dependencies(self):
        tree = ast.parse((Path(__file__).resolve().parents[1] / 'server/hermes_worker.py').read_text(encoding='utf8'))
        registration = next(node.value for node in tree.body if isinstance(node, ast.Expr)
                            and isinstance(node.value, ast.Call)
                            and any(k.arg == 'name' and isinstance(k.value, ast.Constant)
                                    and k.value.value == 'island_dispatch' for k in node.value.keywords))
        schema = ast.literal_eval(next(k.value for k in registration.keywords if k.arg == 'schema'))
        self.assertEqual(schema['parameters']['properties']['dependsOn']['maxItems'], 20)
        self.assertFalse(schema['parameters']['additionalProperties'])


if __name__ == '__main__':
    unittest.main()
