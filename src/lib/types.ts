export type WorkTag = {
  id: string;
  name: string;
};

export type WorkImage = {
  id: string;
  work_id: string;
  storage_path: string;
  width: number;
  height: number;
  display_order: number;
  created_at: string;
};

export type Work = {
  id: string;
  description: string | null;
  created_date: string;
  cover_image_id: string | null;
  created_at: string;
  updated_at: string;
  images: WorkImage[];
  tags: WorkTag[];
};

export type Profile = {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
};
