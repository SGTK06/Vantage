import sys
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase, mock

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.categorizer import categorize_line_items_pipeline


class FakeTable:
    """Minimal Supabase table query fake for categorization tests."""

    def __init__(self, rows):
        self.rows = rows
        self.inserted = []

    def select(self, *_):
        return self

    def eq(self, *_):
        return self

    def insert(self, payload):
        self.inserted.append(payload)
        return self

    def execute(self):
        if self.inserted:
            payload = dict(self.inserted[-1])
            payload.setdefault("id", "created-category")
            return SimpleNamespace(data=[payload])
        return SimpleNamespace(data=self.rows)


class FakeSupabase:
    """Supabase fake exposing category table reads, inserts, and RPC calls."""

    def __init__(self, categories, rpc_rows=None):
        self.categories = FakeTable(categories)
        self.rpc_rows = rpc_rows or []
        self.rpc_calls = []

    def table(self, name):
        self.assert_category_table(name)
        return self.categories

    def assert_category_table(self, name):
        if name != "product_categories":
            raise AssertionError(f"Unexpected table: {name}")

    def rpc(self, name, payload):
        self.rpc_calls.append((name, payload))
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=self.rpc_rows))


class TestCategorizationPipeline(TestCase):
    """Covers the embedding-first and LLM fallback decisions."""

    @mock.patch("app.categorizer.get_text_embedding", return_value=[0.1, 0.2])
    @mock.patch("app.categorizer.ask_gemma_to_categorize")
    def test_vector_match_skips_llm_and_preserves_item_fields(self, ask, _embedding):
        """A qualifying RPC match should be assigned without invoking Gemma."""
        supabase = FakeSupabase(
            [{"id": "cat-1", "name": "Office Supplies", "description": "Stationery"}],
            [{"id": "cat-1", "name": "Office Supplies"}],
        )
        items = [{"description": "A4 paper", "quantity": 2}]

        result = categorize_line_items_pipeline(items, "user-1", supabase)

        self.assertEqual(result, [{"description": "A4 paper", "quantity": 2, "category_id": "cat-1", "category_name": "Office Supplies"}])
        ask.assert_not_called()
        self.assertEqual(supabase.rpc_calls[0][1]["filter_user_id"], "user-1")

    @mock.patch("app.categorizer.get_text_embedding", return_value=[0.3, 0.4])
    @mock.patch("app.categorizer.ask_gemma_to_categorize", return_value={
        "category_name": "IT Hardware",
        "description": "Computers and related equipment",
        "is_new": True,
    })
    def test_llm_new_category_is_inserted_and_reused(self, ask, embedding):
        """An uncertain item should create a category and reuse its cache entry."""
        supabase = FakeSupabase([])
        items = [{"description": "Laptop"}, {"description": "USB keyboard"}]

        result = categorize_line_items_pipeline(items, "user-1", supabase)

        self.assertEqual([item["category_name"] for item in result], ["IT Hardware", "IT Hardware"])
        self.assertEqual(len(supabase.categories.inserted), 1)
        self.assertEqual(supabase.categories.inserted[0]["user_id"], "user-1")
        self.assertEqual(ask.call_count, 2)
        self.assertEqual(embedding.call_count, 3)  # two item embeddings plus one category embedding

    @mock.patch("app.categorizer.get_text_embedding", return_value=[0.5])
    @mock.patch("app.categorizer.ask_gemma_to_categorize", return_value={
        "category_name": "Office Supplies",
        "description": "Stationery and consumables",
        "is_new": False,
    })
    def test_llm_existing_category_is_resolved_without_insert(self, ask, _embedding):
        """An LLM-selected existing category should resolve from the local cache."""
        supabase = FakeSupabase([{"id": "cat-2", "name": "Office Supplies", "description": "Stationery"}])

        result = categorize_line_items_pipeline([{"description": "Notebook"}], "user-1", supabase)

        self.assertEqual(result[0]["category_id"], "cat-2")
        self.assertEqual(len(supabase.categories.inserted), 0)
        ask.assert_called_once_with("Notebook", ["Office Supplies"])

    def test_blank_description_gets_general_category_without_external_calls(self):
        """Blank invoice descriptions should receive the safe default category."""
        supabase = FakeSupabase([])
        with mock.patch("app.categorizer.get_text_embedding") as embedding, \
             mock.patch("app.categorizer.ask_gemma_to_categorize") as ask:
            result = categorize_line_items_pipeline([{"description": "  ", "total_cost": 4}], "user-1", supabase)

        self.assertEqual(result[0]["category_name"], "General")
        self.assertNotIn("category_id", result[0])
        embedding.assert_not_called()
        ask.assert_not_called()
