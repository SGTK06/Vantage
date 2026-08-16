-- ====================================================================
-- Vantage: Relational Schema for Vendors, Invoices, Line Items & Categories
-- ====================================================================

-- Enable pgvector extension for embedding vector operations
create extension if not exists vector;

-- 1. Vendors Table
create table if not exists vendors (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  address text,
  created_at timestamp with time zone default now(),
  constraint unique_user_vendor_name unique (user_id, name)
);

-- 2. Product Categories Table (Stores 3072-dim vectors from gemini-embedding-001)
create table if not exists product_categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  embedding vector(3072) not null,
  created_at timestamp with time zone default now(),
  constraint unique_user_category_name unique (user_id, name)
);

-- If product_categories table already exists with vector(768), alter column to vector(3072):
-- alter table product_categories alter column embedding type vector(3072);

-- 3. Invoices Table (Linked to Vendors)
create table if not exists invoices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  vendor_id uuid references vendors(id) on delete set null,
  file_path text not null,
  file_name text not null,
  customer_name text,
  invoice_number text not null,
  invoice_date date,
  due_date date,
  currency text default 'USD',
  subtotal numeric(12, 2),
  tax_amount numeric(12, 2),
  discount_amount numeric(12, 2),
  total_amount numeric(12, 2) not null,
  uploaded_at timestamp with time zone default now()
);

-- 4. Line Items Table (Linked to Invoices and Product Categories)
create table if not exists line_items (
  id uuid default gen_random_uuid() primary key,
  invoice_id uuid references invoices(id) on delete cascade not null,
  category_id uuid references product_categories(id) on delete set null,
  line_no integer not null,
  description text not null,
  quantity numeric(12, 2),
  unit_cost numeric(12, 2),
  total_cost numeric(12, 2)
);

-- 5. RPC Function for Vector Similarity Search in Supabase using pgvector cosine distance (<=>)
create or replace function match_product_categories(
  query_embedding vector(3072),
  match_threshold double precision,
  match_count integer,
  filter_user_id uuid
)
returns table (
  id uuid,
  name text,
  description text,
  similarity double precision
)
language sql stable
as $$
  select
    id,
    name,
    description,
    1 - (embedding <=> query_embedding) as similarity
  from product_categories
  where user_id = filter_user_id
    and 1 - (embedding <=> query_embedding) >= match_threshold
  order by similarity desc
  limit match_count;
$$;

-- 6. Enable Row Level Security (RLS)
alter table vendors enable row level security;
alter table product_categories enable row level security;
alter table invoices enable row level security;
alter table line_items enable row level security;

-- 7. RLS Policies for Vendors
create policy "Users can view their own vendors"
  on vendors for select
  using (auth.uid() = user_id);

create policy "Users can insert their own vendors"
  on vendors for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own vendors"
  on vendors for update
  using (auth.uid() = user_id);

create policy "Users can delete their own vendors"
  on vendors for delete
  using (auth.uid() = user_id);

-- 8. RLS Policies for Product Categories
create policy "Users can view their own categories"
  on product_categories for select
  using (auth.uid() = user_id);

create policy "Users can insert their own categories"
  on product_categories for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own categories"
  on product_categories for update
  using (auth.uid() = user_id);

create policy "Users can delete their own categories"
  on product_categories for delete
  using (auth.uid() = user_id);

-- 9. RLS Policies for Invoices
create policy "Users can view their own invoices"
  on invoices for select
  using (auth.uid() = user_id);

create policy "Users can insert their own invoices"
  on invoices for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own invoices"
  on invoices for update
  using (auth.uid() = user_id);

create policy "Users can delete their own invoices"
  on invoices for delete
  using (auth.uid() = user_id);

-- 10. RLS Policies for Line Items
create policy "Users can view their own line items"
  on line_items for select
  using (
    exists (
      select 1 from invoices
      where invoices.id = line_items.invoice_id
      and invoices.user_id = auth.uid()
    )
  );

create policy "Users can insert their own line items"
  on line_items for insert
  with check (
    exists (
      select 1 from invoices
      where invoices.id = line_items.invoice_id
      and invoices.user_id = auth.uid()
    )
  );

create policy "Users can update their own line items"
  on line_items for update
  using (
    exists (
      select 1 from invoices
      where invoices.id = line_items.invoice_id
      and invoices.user_id = auth.uid()
    )
  );

create policy "Users can delete their own line items"
  on line_items for delete
  using (
    exists (
      select 1 from invoices
      where invoices.id = line_items.invoice_id
      and invoices.user_id = auth.uid()
    )
  );

-- 11. Storage Bucket RLS Policies for 'invoices' bucket
create policy "Users can upload their own invoices"
  on storage.objects for insert
  with check (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can read their own invoices"
  on storage.objects for select
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own invoices"
  on storage.objects for delete
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);