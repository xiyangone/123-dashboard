// 共享 schema 类型：与 backend/snapshot.py 输出对齐。允许字段缺失。

export interface Snapshot {
  ts: number;
  sources: Record<string, number>;
  batch: BatchProgress;
  codex2api: Codex2apiProgress;
  phone_inuse: Record<string, PhoneInUse>;
  phone_exhausted: PhoneExhausted[];
  callback: Record<string, CallbackState>;
  dead: DeadAccount[];
}

export interface BatchSummary {
  total?: number;
  success?: number;
  pp_done_pending_callback?: number;
  registered_pending_pp?: number;
  pending_register?: number;
  failed?: number;
}

export interface CallbackQueue {
  queue_size?: number;
  ready_queue_size?: number;
  cooldown_queue_size?: number;
  terminal_queue_size?: number;
  running?: number;
  success?: number;
  failed?: number;
  permanently_failed?: number;
  by_status?: Record<string, number>;
}

export interface CallbackGroup {
  group_key?: string;
  worker_tag?: string;
  status?: string;
  accounts?: string[];
  current_email?: string;
  error?: string;
  updated_at?: string;
}

export interface BatchAccount {
  email?: string;
  email_source?: string;
  status?: string;
  saved_status?: string;
  resume_status?: string;
  worker_tag?: string;
  group_key?: string;
  stage?: string;
  register_ok?: boolean;
  checkout_url?: boolean | string;
  paypal_ok?: boolean;
  paypal_attempts_done?: number;
  paypal_done_at?: number;
  at_ok?: boolean;
  oauth_attempts?: number;
  codex2api_id?: number;
  codex2api_plan?: string;
  error?: string;
  error_code?: string;
  local_plus_export?: boolean;
  callback_state_status?: string;
  callback_state_plan?: string;
  evidence?: string[];
  updated_at?: string;
}

export interface BatchProgress {
  schema_version?: number;
  generated_at?: string;
  updated_at?: string;
  stage?: string;
  accounts_file?: string;
  workers?: { tag: string; config_path: string }[];
  summary?: BatchSummary;
  callback_queue?: CallbackQueue;
  callback_groups?: Record<string, CallbackGroup>;
  accounts?: Record<string, BatchAccount>;
}

export interface Codex2apiAccount {
  email?: string;
  status?: string;
  reason?: string;
  planType?: string;
  checkedAt?: string;
  event?: string;
  deletedStaleIds?: number[] | string;
  updated_at?: string;
}

export interface Codex2apiEvent {
  at?: string;
  email?: string;
  status?: string;
  message?: string;
}

export interface Codex2apiProgress {
  source?: string;
  stage?: string;
  updated_at?: string;
  total?: number;
  processed?: number;
  healthy?: number;
  revived?: number;
  failed?: number;
  dead?: number;
  cleaned?: number;
  skipped?: number;
  revive_attempted?: number;
  current_email?: string;
  accounts?: Record<string, Codex2apiAccount>;
  events?: Codex2apiEvent[];
}

export interface PhoneInUse {
  label?: string;
  at?: number;
}

export interface PhoneExhausted {
  label?: string;
  email?: string;
  used_phones?: string[];
  at?: number | string;
}

export interface CallbackState {
  status?: string;
  attempts?: number;
  last_attempt_at?: number;
  last_worker_tag?: string;
  last_error?: string;
  last_failed_worker?: string;
  succeeded_at?: number;
  account_id?: number;
  plan_type?: string;
  cooldown_until?: number;
  deactivated?: boolean;
}

export interface DeadAccount {
  email?: string;
  marked_at?: string;
  reason?: string;
  detail?: string;
  do_not_retry?: boolean;
  evidence?: Record<string, unknown>;
}
