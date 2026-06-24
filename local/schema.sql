create table if not exists public.users (
    user_id bigint primary key,
    email varchar(100) unique not null,
    password varchar(255) not null,
    name varchar(50) not null,
    department varchar(50),
    role varchar(20) not null,
    status varchar(10) default '사용',
    needs_password_reset boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.defects (
    defect_id bigint primary key,
    title varchar(255) not null,
    test_type varchar(50),
    severity varchar(20),
    priority varchar(10),
    status varchar(20) default 'Open',
    steps_to_repro text,
    menu_name varchar(255),
    screen_name varchar(255),
    screen_url text,
    screenshot text,
    defect_identification varchar(50),
    env_info varchar(255),
    creator varchar(255),
    assignee varchar(255),
    action_comment text,
    action_due_date date,
    action_start date,
    action_end date,
    is_deleted varchar(1) default 'N',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.common_codes (
    id bigserial primary key,
    group_code varchar(50) not null,
    code_value varchar(100) not null,
    code_name varchar(255) not null,
    color varchar(50),
    sort_order integer default 0,
    is_active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.app_settings (
    key varchar(100) primary key,
    value jsonb not null,
    updated_at timestamptz default now()
);

create table if not exists public.defect_save_error_logs (
    id bigserial primary key,
    client_log_id varchar(80) unique,
    operation varchar(30) not null,
    defect_id bigint,
    pending_source varchar(30) default 'manual',
    stage varchar(50),
    error_type varchar(50),
    message text not null,
    error_code varchar(50),
    error_details text,
    error_hint text,
    runtime_context jsonb default '{}'::jsonb,
    payload_summary jsonb default '{}'::jsonb,
    extra jsonb default '{}'::jsonb,
    reported_by varchar(50),
    created_at timestamptz default now()
);

create table if not exists public.defect_history (
    id bigserial primary key,
    defect_id bigint,
    action varchar(50),
    status_before varchar(50),
    status_after varchar(50),
    changed_data jsonb default '{}'::jsonb,
    changed_by varchar(100),
    created_at timestamptz default now()
);

create index if not exists idx_defects_created_at on public.defects (created_at desc);
create index if not exists idx_defects_status on public.defects (status);
create index if not exists idx_defects_test_type on public.defects (test_type);
create index if not exists idx_defects_assignee on public.defects (assignee);
create index if not exists idx_defects_is_deleted on public.defects (is_deleted);
create index if not exists idx_defects_action_due_date on public.defects (action_due_date);
create index if not exists idx_common_codes_group_sort on public.common_codes (group_code, sort_order, code_value);
create index if not exists idx_defect_save_error_logs_created_at on public.defect_save_error_logs (created_at desc);
create index if not exists idx_defect_save_error_logs_pending_source on public.defect_save_error_logs (pending_source);
create index if not exists idx_defect_save_error_logs_operation on public.defect_save_error_logs (operation);
create index if not exists idx_defect_history_defect_id on public.defect_history (defect_id);
