## Product Clustering and Categorization

First when the invoice is added, the items purchased are cross checked against an existing list of product categories. If they are not similar or the score from the embedding comparison is uncertain, they are processed by querying an LLM to either match or create a new category for the given class of items.

Instead of embedding all the purchased items to representative vectors and then clustering into categories, this hybrid technique is efficient as the categorization is cached by storing directly in database and then later queried for getting statistics immediately instead of re-grouping or running clustering algorithms for the purchased items often.

Future Extension: The same clustering principles can be applied to this categorization by adjusting a given threshold, the match between a product and a category must be greater than this set threshold for a product to be considered of the given category.

**Pros:** Faster querying and efficient grouping allows the app to be faster and smoother. This hybrid architecture is also suitable given the compute limits of Render's Free Tier Hosting.

**Cons:** Although this can dynamically identify and allocate products into existing categories or create new ones, This does not support efficient re-categorization. The re-clustering products into new groups (categories) will be expensive if the given threshold is changed after certain invoices have already been processed

**Conclusion:** Despite its shortcomings, the hybrid architecture is chosen over pure vector embeddings for simplicity and since the end user will not have a threshold calibrator there wont be any issues regarding re-grouping of products into newly discovered categories.
