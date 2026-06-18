import { NormalizedSignal } from './normalizer';

export type SignalClusterInput = {
  id: string;
  regionId: string;
  categoryId: string;
  title: string;
  summary: string;
  score: number;
  signals: NormalizedSignal[];
};

export class ClustererService {
  /**
   * Helper to calculate Jaccard Similarity between two sets of words
   */
  private static calculateJaccardSimilarity(arr1: string[], arr2: string[]): number {
    if (arr1.length === 0 || arr2.length === 0) return 0;
    const set1 = new Set(arr1.map(w => w.toLowerCase()));
    const set2 = new Set(arr2.map(w => w.toLowerCase()));
    
    let intersectionCount = 0;
    for (const item of set1) {
      if (set2.has(item)) {
        intersectionCount++;
      }
    }
    
    const unionCount = set1.size + set2.size - intersectionCount;
    return intersectionCount / unionCount;
  }

  /**
   * Helper to check if two signals should belong to the same cluster
   */
  private static shouldClusterTogether(sig1: NormalizedSignal, sig2: NormalizedSignal, maxTimeDiffHours = 48): boolean {
    // 1. Must be in same region and category
    if (sig1.regionId !== sig2.regionId || sig1.categoryId !== sig2.categoryId) {
      return false;
    }

    // 1.5 Synthetic signals with different keywords must not cluster together
    const isSynth1 = sig1.metadata?.synthetic === true;
    const isSynth2 = sig2.metadata?.synthetic === true;
    if (isSynth1 || isSynth2) {
      if (sig1.metadata?.keyword !== sig2.metadata?.keyword) {
        return false;
      }
    }

    // 2. Time proximity check (must be within time window)
    const timeDiffMs = Math.abs(sig1.publishedAt!.getTime() - sig2.publishedAt!.getTime());
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
    if (timeDiffHours > maxTimeDiffHours) {
      return false;
    }

    // 3. Exact URL match (immediate merge)
    if (sig1.cleanUrl === sig2.cleanUrl) {
      return true;
    }

    // 4. Check Jaccard similarity on titles
    const titleSim = this.calculateJaccardSimilarity(sig1.extractedKeywords, sig2.extractedKeywords);
    if (titleSim > 0.3) {
      return true;
    }

    // 5. Check if they share a domain AND have some keyword overlap
    const sameDomain = sig1.domain === sig2.domain && sig1.domain !== '';
    const keywordOverlap = sig1.extractedKeywords.filter(k => sig2.extractedKeywords.includes(k)).length;
    if (sameDomain && keywordOverlap >= 2) {
      return true;
    }

    return false;
  }

  /**
   * Clusters signals into group arrays. Future-ready for embedding-based clustering.
   */
  static async clusterSignals(rawSignals: NormalizedSignal[]): Promise<SignalClusterInput[]> {
    const clusters: SignalClusterInput[] = [];
    let clusterIdCounter = 1;

    for (const signal of rawSignals) {
      let merged = false;

      // Try to merge into an existing cluster
      for (const cluster of clusters) {
        // Compare with the first/primary signal of the cluster
        const primarySignal = cluster.signals[0];
        if (primarySignal && this.shouldClusterTogether(signal, primarySignal)) {
          cluster.signals.push(signal);
          merged = true;
          break;
        }
      }

      // If not merged, create a new cluster
      if (!merged) {
        clusters.push({
          id: `cluster_temp_${clusterIdCounter++}`,
          regionId: signal.regionId,
          categoryId: signal.categoryId,
          title: signal.title, // Primary title
          summary: signal.summary || signal.title,
          score: 0, // Calculated during scoring
          signals: [signal]
        });
      }
    }

    // Post-process clusters: choose the title of the signal with the highest engagement score as the cluster title
    for (const cluster of clusters) {
      let highestScoreSignal = cluster.signals[0];
      for (const sig of cluster.signals) {
        if (sig.normalizedScore > highestScoreSignal.normalizedScore) {
          highestScoreSignal = sig;
        }
      }
      cluster.title = highestScoreSignal.title;
      cluster.summary = highestScoreSignal.summary || highestScoreSignal.title;
    }

    return clusters;
  }
}
