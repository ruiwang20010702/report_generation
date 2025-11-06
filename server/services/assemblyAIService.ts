import { AssemblyAI, TranscribeParams } from 'assemblyai';

interface TranscriptionProgress {
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress?: number;
  text?: string;
  error?: string;
}

interface TranscriptionResult {
  text: string;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  duration?: number;
  language?: string;
}

interface AssemblyAIStats {
  totalMinutesUsed: number;
  freeMinutesLimit: number;
  remainingMinutes: number;
  lastReset: Date;
}

class AssemblyAIService {
  private client: AssemblyAI | null = null;
  private apiKey: string | null = null;
  private readonly FREE_MINUTES_LIMIT = 300; // 5 hours = 300 minutes
  private stats: AssemblyAIStats;

  constructor() {
    this.apiKey = process.env.ASSEMBLYAI_API_KEY || null;
    
    // Initialize stats (in production, this should be stored in database)
    this.stats = {
      totalMinutesUsed: 0,
      freeMinutesLimit: this.FREE_MINUTES_LIMIT,
      remainingMinutes: this.FREE_MINUTES_LIMIT,
      lastReset: new Date()
    };

    if (this.apiKey) {
      this.client = new AssemblyAI({
        apiKey: this.apiKey
      });
      console.log('✅ AssemblyAI service initialized successfully');
    } else {
      console.warn('⚠️  AssemblyAI API key not found. Service will not be available.');
    }
  }

  /**
   * Check if AssemblyAI is available and has remaining quota
   */
  isAvailable(): boolean {
    return this.client !== null && this.hasRemainingQuota();
  }

  /**
   * Check if there's remaining free quota
   */
  hasRemainingQuota(): boolean {
    return this.stats.remainingMinutes > 0;
  }

  /**
   * Get current usage statistics
   */
  getStats(): AssemblyAIStats {
    return { ...this.stats };
  }

  /**
   * Update usage statistics
   */
  private updateStats(durationInSeconds: number): void {
    const minutes = Math.ceil(durationInSeconds / 60);
    this.stats.totalMinutesUsed += minutes;
    this.stats.remainingMinutes = Math.max(
      0,
      this.stats.freeMinutesLimit - this.stats.totalMinutesUsed
    );
  }

  /**
   * Transcribe video from URL
   * @param videoUrl - Direct URL to the video file
   * @param options - Additional transcription options
   */
  async transcribeFromURL(
    videoUrl: string,
    options: {
      language?: string;
      speakerLabels?: boolean;
      onProgress?: (progress: TranscriptionProgress) => void;
    } = {}
  ): Promise<TranscriptionResult> {
    if (!this.client) {
      throw new Error('AssemblyAI client not initialized. Please set ASSEMBLYAI_API_KEY.');
    }

    if (!this.hasRemainingQuota()) {
      throw new Error('AssemblyAI free quota exceeded. Fallback to alternative service.');
    }

    try {
      console.log('🎯 Starting AssemblyAI transcription from URL:', videoUrl);

      // Prepare transcription parameters
      const params: TranscribeParams = {
        audio_url: videoUrl,
        language_code: options.language || 'en',
        speaker_labels: options.speakerLabels || false,
        // Enable advanced features
        punctuate: true,
        format_text: true,
        // Diarization for speaker identification
        ...(options.speakerLabels && { speakers_expected: 2 })
      };

      // Submit transcription job
      const transcript = await this.client.transcripts.transcribe(params);

      // Poll for progress
      if (options.onProgress) {
        options.onProgress({
          status: transcript.status as any,
          progress: 100
        });
      }

      // Check for errors
      if (transcript.status === 'error') {
        throw new Error(transcript.error || 'Transcription failed');
      }

      // Update usage stats
      if (transcript.audio_duration) {
        this.updateStats(transcript.audio_duration);
      }

      console.log('✅ AssemblyAI transcription completed');
      console.log(`📊 Usage: ${this.stats.remainingMinutes} minutes remaining`);

      // Return formatted result
      return {
        text: transcript.text || '',
        words: transcript.words?.map(word => ({
          text: word.text,
          start: word.start / 1000, // Convert to seconds
          end: word.end / 1000,
          confidence: word.confidence
        })),
        duration: transcript.audio_duration ?? undefined,
        language: options.language || 'en'
      };
    } catch (error: any) {
      console.error('❌ AssemblyAI transcription error:', error);
      
      // Check if it's a quota error
      if (error.message?.includes('quota') || error.message?.includes('limit')) {
        this.stats.remainingMinutes = 0;
      }

      throw new Error(`AssemblyAI transcription failed: ${error.message}`);
    }
  }

  /**
   * Transcribe video with streaming progress updates
   * @param videoUrl - Direct URL to the video file
   * @param onProgress - Callback for progress updates
   */
  async transcribeWithProgress(
    videoUrl: string,
    onProgress: (progress: TranscriptionProgress) => void
  ): Promise<TranscriptionResult> {
    if (!this.client) {
      throw new Error('AssemblyAI client not initialized');
    }

    try {
      // Notify queued
      onProgress({ status: 'queued', progress: 0 });

      // Submit job
      let transcript = await this.client.transcripts.create({
        audio_url: videoUrl
      });

      // Poll for status
      while (transcript.status !== 'completed' && transcript.status !== 'error') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        transcript = await this.client.transcripts.get(transcript.id);
        
        // Estimate progress (AssemblyAI doesn't provide exact progress)
        const progress = transcript.status === 'processing' ? 50 : 
                        transcript.status === 'completed' ? 100 : 10;
        
        onProgress({
          status: transcript.status as any,
          progress
        });
      }

      if (transcript.status === 'error') {
        throw new Error(transcript.error || 'Transcription failed');
      }

      // Update stats
      if (transcript.audio_duration) {
        this.updateStats(transcript.audio_duration);
      }

      const result: TranscriptionResult = {
        text: transcript.text || '',
        words: transcript.words?.map(word => ({
          text: word.text,
          start: word.start / 1000,
          end: word.end / 1000,
          confidence: word.confidence
        })),
        duration: transcript.audio_duration ?? undefined
      };

      onProgress({
        status: 'completed',
        progress: 100,
        text: result.text
      });

      return result;
    } catch (error: any) {
      onProgress({
        status: 'error',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get transcript by ID (for retrieving previous transcriptions)
   */
  async getTranscript(transcriptId: string): Promise<TranscriptionResult> {
    if (!this.client) {
      throw new Error('AssemblyAI client not initialized');
    }

    const transcript = await this.client.transcripts.get(transcriptId);

    if (transcript.status !== 'completed') {
      throw new Error(`Transcript not ready. Status: ${transcript.status}`);
    }

    return {
      text: transcript.text || '',
      words: transcript.words?.map(word => ({
        text: word.text,
        start: word.start / 1000,
        end: word.end / 1000,
        confidence: word.confidence
      })),
      duration: transcript.audio_duration ?? undefined
    };
  }
}

// Lazy singleton initialization
// We don't create the instance immediately because environment variables
// might not be loaded yet when this module is imported
let _assemblyAIServiceInstance: AssemblyAIService | null = null;

export function getAssemblyAIService(): AssemblyAIService {
  if (!_assemblyAIServiceInstance) {
    _assemblyAIServiceInstance = new AssemblyAIService();
  }
  return _assemblyAIServiceInstance;
}

// For backward compatibility, export a proxy that creates the instance on first access
export const assemblyAIService = {
  get isAvailable() {
    return getAssemblyAIService().isAvailable.bind(getAssemblyAIService());
  },
  get hasRemainingQuota() {
    return getAssemblyAIService().hasRemainingQuota.bind(getAssemblyAIService());
  },
  get getStats() {
    return getAssemblyAIService().getStats.bind(getAssemblyAIService());
  },
  get transcribeFromURL() {
    return getAssemblyAIService().transcribeFromURL.bind(getAssemblyAIService());
  }
};

export type { TranscriptionResult, TranscriptionProgress, AssemblyAIStats };

