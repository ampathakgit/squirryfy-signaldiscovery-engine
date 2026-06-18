import { RawSignal, SourceConnector, RegionConfig, CategoryConfig, SourceConfig } from './base';

export class InstagramStubConnector implements SourceConnector {
  async fetchSignals(input: {
    region: RegionConfig;
    category: CategoryConfig;
    sourceConfig: SourceConfig;
    timeWindowHours: number;
    keywords: string[];
    currentDate?: Date;
  }): Promise<RawSignal[]> {
    // Stub disabled - we only ingest real live crawled signals
    return [];
  }
}

export class TikTokStubConnector implements SourceConnector {
  async fetchSignals(input: {
    region: RegionConfig;
    category: CategoryConfig;
    sourceConfig: SourceConfig;
    timeWindowHours: number;
    keywords: string[];
    currentDate?: Date;
  }): Promise<RawSignal[]> {
    // Stub disabled - we only ingest real live crawled signals
    return [];
  }
}

