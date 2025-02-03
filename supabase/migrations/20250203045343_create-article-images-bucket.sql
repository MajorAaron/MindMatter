-- Create a bucket for article images
insert into storage.buckets (id, name, public)
values ('article-images', 'article-images', true);

-- Set up security policies for the bucket
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'article-images' );

create policy "Anon users can upload images"
  on storage.objects for insert
  with check (
    bucket_id = 'article-images'
  );

create policy "Anon users can update their images"
  on storage.objects for update
  using ( bucket_id = 'article-images' );

create policy "Anon users can delete their images"
  on storage.objects for delete
  using (
    bucket_id = 'article-images'
  );
