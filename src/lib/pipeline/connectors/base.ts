export type RegionConfig = {
  id: string;
  name: string;
  timezone: string;
  languages: string[];
  enabled: boolean;
};

export type CategoryConfig = {
  id: string;
  name: string;
  enabled: boolean;
  defaultTopN: number;
};

export type SourceConfig = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
};

export type RawSignal = {
  id?: string;
  regionId: string;
  categoryId: string;
  sourceId: string;
  sourceType: "article" | "video" | "social" | "trend" | "forum" | "official" | "rss";
  title: string;
  url: string;
  author?: string;
  publishedAt?: Date;
  rawText?: string;
  summary?: string;
  engagement?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    upvotes?: number;
  };
  metadata?: Record<string, any>;
};

export interface SourceConnector {
  fetchSignals(input: {
    region: RegionConfig;
    category: CategoryConfig;
    sourceConfig: SourceConfig;
    timeWindowHours: number;
    keywords: string[];
    currentDate?: Date;
  }): Promise<RawSignal[]>;
}
