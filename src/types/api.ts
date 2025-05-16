// API Request Types
export interface AddVideoRequest {
  videoUrl: string;
}

// API Response Types
export interface ApiResponse<T> {
  message?: string;
  data?: T;
}

export interface Video {
  id: number;
  youtubeVideoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  url: string;
  embedUrl: string;
  createdAt: Date;
} 