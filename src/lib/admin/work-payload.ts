export type EditableImage = {
  id: string;
  storagePath: string;
  width: number;
  height: number;
  displayOrder: number;
};

export type SaveWorkPayload = {
  description: string;
  createdDate: string;
  tags: string[];
  coverImageId: string | null;
  images: EditableImage[];
};
