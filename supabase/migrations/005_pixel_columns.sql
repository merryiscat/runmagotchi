ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS character_pixel_url text DEFAULT null;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS character_final_pixel_url text DEFAULT null;
