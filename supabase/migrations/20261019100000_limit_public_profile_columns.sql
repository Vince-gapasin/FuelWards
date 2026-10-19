-- Profiles are readable by everyone (usernames appear on the leaderboard), but only these columns.
-- `role` would reveal who the admins are, and `privacy_accepted_at` is nobody else's business.
-- Admin checks still work: public.is_admin() runs as security definer.
revoke select on public.profiles from anon, authenticated;
grant select (id, username, display_name, avatar_url, created_at) on public.profiles to anon, authenticated;
