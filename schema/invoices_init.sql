-- ==========================================================
-- Vantage: Invoices & Line Items Schema for Supabase
-- ==========================================================

-- 1. Create Invoices Table
create table if not exists invoices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  file_path text not null,
  file_name text not null,
  supplier_name text not null,
  supplier_address text,
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

-- 2. Create Line Items Table (1 Invoice -> N Line Items)
create table if not exists line_items (
  id uuid default gen_random_uuid() primary key,
  invoice_id uuid references invoices(id) on delete cascade not null,
  line_no integer not null,
  description text not null,
  quantity numeric(12, 2),
  unit_cost numeric(12, 2),
  total_cost numeric(12, 2)
);

-- 3. Enable Row Level Security (RLS)
alter table invoices enable row level security;
alter table line_items enable row level security;

-- 4. RLS Policies for Invoices
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

-- 5. RLS Policies for Line Items
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

create policy "Users can delete their own line items"
  on line_items for delete
  using (
    exists (
      select 1 from invoices
      where invoices.id = line_items.invoice_id
      and invoices.user_id = auth.uid()
    )
  );

-- 6. Storage Bucket RLS Policies for 'invoices' bucket
-- Note: Create the 'invoices' bucket in Supabase dashboard if not already created.
create policy "Users can upload their own invoices"
  on storage.objects for insert
  with check (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can read their own invoices"
  on storage.objects for select
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own invoices"
  on storage.objects for delete
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);