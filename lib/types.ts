export type UserRole = "owner" | "manager" | "staff" | "user";
export type BusinessStatus = "pending" | "approved" | "rejected" | "suspended";
export type TicketStatus = "open" | "answered" | "closed";

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  role: UserRole;
  address: string;
  age: number | null;
  gender: string | null;
  created_at: string;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  business_type: string;
  work_type: string;
  shop_phone: string;
  shop_email: string;
  address: string;
  owner_name: string;
  owner_phone: string;
  owner_email: string;
  shop_logo_url: string | null;
  owner_photo_url: string | null;
  status: BusinessStatus;
  created_at: string;
  updated_at: string;
}

export interface BusinessCategory {
  id: string;
  name: string;
}

export interface ItemCategory {
  id: string;
  business_id: string;
  name: string;
}

export interface Item {
  id: string;
  business_id: string;
  name: string;
  kind: "product" | "service";
  base_unit: string;
  base_qty: number;
  price: number;
  category_id: string | null;
  image_url: string | null;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export interface BillLine {
  item_id: string;
  name: string;
  qty: number;
  unit: string;
  rate: number; // effective price per base unit after conversion
  amount: number;
}

export interface Bill {
  id: string;
  business_id: string;
  order_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  items: BillLine[];
  labor_charge: number;
  total_amount: number;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  business_id: string | null;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}
