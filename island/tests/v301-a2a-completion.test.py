import json, os, sys, unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
from a2a_runtime import run_collaboration


class Registry:
    def __init__(self): self.handlers = {}
    def register(self, name, handler, **kwargs): self.handlers[name] = handler


class CompletionTests(unittest.TestCase):
    def scenario(self, steps, stage='offer', receipt=None):
        registry = Registry()
        runs = []
        class Agent:
            def __init__(self, **kwargs):
                self.max_iterations = kwargs['max_iterations']
                self.valid_tool_names = ['a2a_observe', 'a2a_reply']
                self.model = kwargs['model']
                self.fallback = kwargs['fallback_model']
            def run_conversation(self, message, **kwargs):
                runs.append({'message': message, 'budget': self.max_iterations, **kwargs})
                return steps[len(runs)-1](registry)
        packet = {'payload': {'stage': stage, 'receipt': receipt or {}}}
        with patch.dict(os.environ, {'DEEPSEEK_API_KEY': 'fictional-offline-key'}):
            result = run_collaboration(packet, Agent, registry, lambda agent, run_id: None)
        self.assertEqual(result['model'], 'deepseek-flash')
        self.assertEqual(result['tools'], ['a2a_observe', 'a2a_reply'])
        return result, runs

    def accepted(self, registry):
        registry.handlers['a2a_observe']({})
        answer = json.loads(registry.handlers['a2a_reply']({'decision': 'propose', 'message': '请核对本次约定的物资和入场费，准备齐备后由岛主确认。'}))
        self.assertTrue(answer['ok'])
        return {'api_calls': 3, 'final_response': '已登记', 'messages': []}

    def test_announced_observation_continues_same_history_with_remaining_budget(self):
        history = [{'role': 'user', 'content': '请完成当前offer阶段的协作答复。'}, {'role': 'assistant', 'content': '我先读取一下真实的协作资料。'}]
        result, runs = self.scenario([lambda r: {'api_calls': 1, 'messages': history, 'final_response': history[-1]['content']}, self.accepted])
        self.assertEqual([r['budget'] for r in runs], [6, 5])
        self.assertEqual(runs[1]['conversation_history'], history)
        self.assertEqual(result['reply']['decision'], 'propose')

    def test_actual_registered_reply_needs_no_continuation(self):
        result, runs = self.scenario([self.accepted])
        self.assertEqual(len(runs), 1)

    def test_repeated_text_without_a_tool_remains_failed_after_one_continuation(self):
        stopped = lambda r: {'api_calls': 1, 'messages': [{'role': 'assistant', 'content': '马上核对'}]}
        with self.assertRaisesRegex(RuntimeError, '有效工具答复'):
            self.scenario([stopped, stopped])

    def test_failed_provider_result_is_never_automatically_retried(self):
        with self.assertRaisesRegex(RuntimeError, '有效工具答复'):
            self.scenario([lambda r: {'failed': True, 'api_calls': 1, 'messages': [{}]}])

    def test_exhausted_or_unknown_budget_never_gets_fresh_calls(self):
        for calls in [6, 7, None, True, 0, '1']:
            with self.subTest(calls=calls), self.assertRaisesRegex(RuntimeError, '有效工具答复'):
                self.scenario([lambda r: {'api_calls': calls, 'messages': [{}]}])

    def test_reply_before_observing_cannot_register_a_decision(self):
        def premature(registry):
            answer = json.loads(registry.handlers['a2a_reply']({'decision': 'propose', 'message': '我已核对并同意。'}))
            self.assertFalse(answer['ok'])
            return {'api_calls': 1, 'messages': []}
        with self.assertRaisesRegex(RuntimeError, '有效工具答复'):
            self.scenario([premature])

    def test_registered_reply_is_not_replayed_after_later_provider_failure(self):
        def failed_after_registration(registry):
            self.accepted(registry)
            return {'failed': True, 'api_calls': 3, 'messages': [{}]}
        with self.assertRaisesRegex(RuntimeError, '有效工具答复'):
            self.scenario([failed_after_registration])

    def test_unverified_confirm_and_duplicate_reply_stay_rejected(self):
        def invalid(registry):
            registry.handlers['a2a_observe']({})
            answer = json.loads(registry.handlers['a2a_reply']({'decision': 'confirm', 'message': '材料已经预留，请等活动完成后结算。'}))
            self.assertFalse(answer['ok'])
            return {'api_calls': 2, 'messages': []}
        with self.assertRaisesRegex(RuntimeError, '有效工具答复'):
            self.scenario([invalid], stage='confirm')
        def duplicate(registry):
            result = self.accepted(registry)
            answer = json.loads(registry.handlers['a2a_reply']({'decision': 'propose', 'message': '重复登记本轮答复。'}))
            self.assertFalse(answer['ok'])
            return result
        self.scenario([duplicate])


if __name__ == '__main__': unittest.main()
