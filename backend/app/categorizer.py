import json
import logging
import re
from google import genai
from app.config import GEMINI_API_KEY

logger = logging.getLogger(__name__)

def get_genai_client() -> genai.Client:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured in environment variables")
    return genai.Client(api_key=GEMINI_API_KEY)


def get_text_embedding(text: str) -> list[float]:
    """Generates embedding vector using Google AI Studio's gemini-embedding-001 model."""
    client = get_genai_client()
    try:
        response = client.models.embed_content(
            model="gemini-embedding-001",
            contents=text,
        )
        if hasattr(response, "embedding") and hasattr(response.embedding, "values"):
            return response.embedding.values
        if hasattr(response, "embeddings") and len(response.embeddings) > 0:
            return response.embeddings[0].values
        raise RuntimeError("Failed to extract embedding values from gemini-embedding-001 response")
    except Exception as e:
        logger.error(f"Error generating embedding with gemini-embedding-001 for '{text}': {e}")
        raise RuntimeError(f"Embedding generation failed: {str(e)}")


def ask_gemma_to_categorize(
    item_description: str,
    existing_categories: list[str],
) -> dict:
    """Uses Google AI Studio Gemma model to classify the item into an existing category

    or propose a concise new product category.
    """
    client = get_genai_client()

    categories_str = ", ".join(f'"{c}"' for c in existing_categories) if existing_categories else "None (no categories exist yet)"

    prompt = f"""You are an expert product and expense classification assistant for SME invoices.

Task:
Analyze this line item description from an invoice: "{item_description}".
Existing Product Categories: [{categories_str}].

Instructions:
1. If the item clearly fits one of the existing categories, choose that exact category name.
2. If no categories exist or none of the existing categories are a good match, create a standard, concise new category name (e.g. "Office Supplies", "IT Hardware & Equipment", "Software & Cloud Services", "Raw Materials", "Logistics & Shipping", "Utilities & Facilities", "Professional Services", "Maintenance & Repairs", "Marketing & Advertising", "Travel & Entertainment").
3. Provide a brief 1-sentence description for the category.

Respond ONLY with a JSON object in this exact format:
{{
  "category_name": "<category name>",
  "description": "<brief description of the category>",
  "is_new": <true if new category was created, false if existing was chosen>
}}
"""

    models_to_try = [
        "gemma-4-31b-it",
        "gemma-4-26b-a4b-it"
    ]

    last_error = None
    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            raw_text = response.text.strip()

            # Extract JSON substring using regex
            json_match = re.search(r"\{[\s\S]*\}", raw_text)
            if json_match:
                result = json.loads(json_match.group(0))
            else:
                result = json.loads(raw_text)

            cat_name = result.get("category_name", "").strip()
            if not cat_name:
                cat_name = "General Supplies"

            return {
                "category_name": cat_name,
                "description": result.get("description", f"{cat_name} product category"),
                "is_new": result.get("is_new", False),
            }
        except Exception as e:
            logger.warning(f"Model {model_name} categorization attempt failed: {e}")
            last_error = e
            continue

    logger.error(f"All LLM categorization models failed: {last_error}")
    return {
        "category_name": "General Expenses",
        "description": "General business expenses and supplies",
        "is_new": True,
    }


def categorize_line_items_pipeline(
    line_items: list[dict],
    user_id: str,
    supabase_client,
    similarity_threshold: float = 0.75,
) -> list[dict]:
    """Full categorization pipeline:

    1. Embed item with Google gemini-embedding-001.
    2. Vector search in Supabase product_categories via match_product_categories RPC.
    3. If not matched, score uncertain, or no categories exist -> query Gemma LLM.
    4. Store any new categories with embeddings in Supabase.
    5. Return line items populated with category_id and category_name.
    """
    # 1. Fetch existing categories from Supabase
    existing_categories = []
    try:
        cat_resp = supabase_client.table("product_categories").select("id, name, description").eq("user_id", user_id).execute()
        if cat_resp.data:
            existing_categories = cat_resp.data
    except Exception as e:
        logger.error(f"Failed to fetch existing categories from Supabase: {e}")

    existing_category_names = [c["name"] for c in existing_categories]
    category_cache = {c["name"].lower(): c for c in existing_categories}

    categorized_items = []

    for item in line_items:
        desc = item.get("description", "").strip()
        if not desc:
            item_copy = dict(item)
            item_copy["category_name"] = "General"
            categorized_items.append(item_copy)
            continue

        assigned_category_id = None
        assigned_category_name = None

        # 2. Vector search in Supabase using the match_product_categories RPC
        matched_category = None
        item_embedding = None

        try:
            item_embedding = get_text_embedding(desc)
        except Exception as e:
            logger.error(f"Error generating embedding for '{desc}': {e}")

        if item_embedding and existing_categories:
            try:
                rpc_resp = supabase_client.rpc(
                    "match_product_categories",
                    {
                        "query_embedding": item_embedding,
                        "match_threshold": similarity_threshold,
                        "match_count": 1,
                        "filter_user_id": user_id,
                    }
                ).execute()

                if rpc_resp.data and len(rpc_resp.data) > 0:
                    matched_category = rpc_resp.data[0]
            except Exception as e:
                logger.warning(f"Vector search RPC failed: {e}")

        if matched_category:
            # High confidence vector match in Supabase
            assigned_category_id = matched_category["id"]
            assigned_category_name = matched_category["name"]
        else:
            # 3. Uncertain / low score or no categories exist initially -> query Gemma LLM
            llm_result = ask_gemma_to_categorize(desc, existing_category_names)
            cat_name = llm_result["category_name"].strip()
            cat_desc = llm_result.get("description", "")

            # Check if this category already exists in cache/DB
            if cat_name.lower() in category_cache:
                existing_cat = category_cache[cat_name.lower()]
                assigned_category_id = existing_cat["id"]
                assigned_category_name = existing_cat["name"]
            else:
                # Create the new category with its gemini-embedding-001 vector in Supabase
                try:
                    cat_embedding = get_text_embedding(f"{cat_name}: {cat_desc}")
                    new_cat_insert = supabase_client.table("product_categories").insert({
                        "user_id": user_id,
                        "name": cat_name,
                        "description": cat_desc,
                        "embedding": cat_embedding,
                    }).execute()

                    if new_cat_insert.data and len(new_cat_insert.data) > 0:
                        created_cat = new_cat_insert.data[0]
                        assigned_category_id = created_cat["id"]
                        assigned_category_name = created_cat["name"]
                        category_cache[cat_name.lower()] = created_cat
                        existing_category_names.append(cat_name)
                    else:
                        assigned_category_name = cat_name
                except Exception as e:
                    logger.error(f"Failed to insert newly generated category '{cat_name}': {e}")
                    assigned_category_name = cat_name

        item_copy = dict(item)
        item_copy["category_id"] = assigned_category_id
        item_copy["category_name"] = assigned_category_name or "General"
        categorized_items.append(item_copy)

    return categorized_items
