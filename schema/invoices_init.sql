create table invoices (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  file_path text not null,
  file_name text not null,
  uploaded_at timestamp with time zone default now()
);

alter table invoices enable row level security;

create policy "Users can view their own invoices"
  on invoices for select
  using (auth.uid() = user_id);

create policy "Users can insert their own invoices"
  on invoices for insert
  with check (auth.uid() = user_id);

create policy "Users can upload their own invoices"
  on storage.objects for insert
  with check (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can read their own invoices"
  on storage.objects for select
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);