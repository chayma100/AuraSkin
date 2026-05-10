export interface Product {
  id: string;
  name: string;
  brand: string;
  image?: string;
}

export interface Post {
  id: string;
  user: string;
  product: Product;
  title: string;
  content: string;
  rating?: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  user: string;
  content: string;
  createdAt: string;
  replies?: Comment[];
}
