ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS character_image_url text DEFAULT null;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS character_final_image_url text DEFAULT null;
