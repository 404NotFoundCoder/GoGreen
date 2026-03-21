-- 首次登入暱稱引導：完成後不再顯示
alter table public.users
  add column if not exists onboarding_completed boolean not null default false;

-- 既有使用者視為已完成（避免打擾）
update public.users
set onboarding_completed = true
where onboarding_completed = false;
