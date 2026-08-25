export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "user";
  created_at: string;
}

export interface Instance {
  id: string;
  admin_id: string;
  instance_name: string;
  evolution_api_url: string;
  evolution_api_key: string;
  status: "open" | "close" | "connecting" | "qrcode";
  created_at: string;
}

// Safe instance view (no API keys)
export interface InstancePublic {
  id: string;
  instance_name: string;
  status: "open" | "close" | "connecting" | "qrcode";
  created_at: string;
}

export interface UserInstance {
  id: string;
  user_id: string;
  instance_id: string;
  assigned_at: string;
}

export interface AutoResponse {
  id: string;
  instance_id: string;
  user_id: string;
  keyword: string | null;
  regex_pattern: string | null;
  response_text: string;
  response_media_url: string | null;
  is_active: boolean;
  priority: number;
  schedule: {
    from?: string;
    to?: string;
  } | null;
  created_at: string;
}

export interface ResponseLog {
  id: string;
  instance_id: string;
  auto_response_id: string | null;
  user_id: string | null;
  incoming_phone: string;
  incoming_message: string;
  matched_keyword: string | null;
  sent_at: string;
}
