import OpenAI from 'openai';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

export interface TranscriptionResult {
  text: string;
  duration?: number;
  language?: string;
}

export class WhisperService {
  private readonly MAX_FILE_SIZE = 24 * 1024 * 1024; // 24MB (留1MB缓冲)
  
  constructor() {
    // 设置 ffmpeg 路径
    ffmpeg.setFfmpegPath(ffmpegPath.path);
  }

  /**
   * 使用 OpenAI Whisper API 转录视频音频
   */
  async transcribeVideo(
    videoUrl: string,
    openai: OpenAI
  ): Promise<TranscriptionResult> {
    let tempVideoPath: string | null = null;
    let tempAudioPath: string | null = null;

    try {
      console.log('🎙️ Starting transcription for:', videoUrl);

      // 下载视频文件
      const videoBuffer = await this.downloadAudio(videoUrl);
      
      // 保存临时视频文件
      tempVideoPath = path.join('/tmp', `video_${Date.now()}.mp4`);
      fs.writeFileSync(tempVideoPath, videoBuffer);
      
      const videoSize = videoBuffer.length;
      console.log(`📦 Downloaded video size: ${(videoSize / 1024 / 1024).toFixed(2)}MB`);

      // 提取并压缩音频
      tempAudioPath = await this.extractAndCompressAudio(tempVideoPath);
      
      const audioSize = fs.statSync(tempAudioPath).size;
      console.log(`🎵 Compressed audio size: ${(audioSize / 1024 / 1024).toFixed(2)}MB`);

      // 检查文件大小
      if (audioSize > this.MAX_FILE_SIZE) {
        throw new Error(`音频文件过大 (${(audioSize / 1024 / 1024).toFixed(2)}MB)，超过OpenAI限制 (25MB)。请使用更短的视频。`);
      }

      // 调用 Whisper API
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempAudioPath),
        model: 'whisper-1',
        language: 'en', // 指定英语
        response_format: 'verbose_json', // 获取详细信息
      });

      console.log('✅ Transcription complete');

      return {
        text: transcription.text,
        duration: (transcription as any).duration,
        language: (transcription as any).language,
      };
    } catch (error) {
      console.error('❌ Transcription error:', error);
      throw new Error(`Failed to transcribe video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // 清理临时文件
      if (tempVideoPath && fs.existsSync(tempVideoPath)) {
        fs.unlinkSync(tempVideoPath);
      }
      if (tempAudioPath && fs.existsSync(tempAudioPath)) {
        fs.unlinkSync(tempAudioPath);
      }
    }
  }

  /**
   * 从视频中提取音频并压缩
   */
  private async extractAndCompressAudio(videoPath: string): Promise<string> {
    const outputPath = path.join('/tmp', `audio_${Date.now()}.mp3`);
    
    return new Promise((resolve, reject) => {
      console.log('🎵 Extracting and compressing audio...');
      
      ffmpeg(videoPath)
        .outputOptions([
          '-vn',              // 不要视频
          '-acodec libmp3lame', // 使用 MP3 编码
          '-ar 16000',        // 16kHz 采样率（Whisper 推荐）
          '-ac 1',            // 单声道
          '-b:a 32k',         // 32kbps 比特率（足够语音识别）
        ])
        .output(outputPath)
        .on('start', (cmd) => {
          console.log('   🔧 FFmpeg command:', cmd);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`   ⏳ Progress: ${progress.percent.toFixed(1)}%`);
          }
        })
        .on('end', () => {
          console.log('✅ Audio extraction complete');
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('❌ FFmpeg error:', err);
          reject(new Error(`Failed to extract audio: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * 下载视频/音频文件
   */
  private async downloadAudio(url: string): Promise<Buffer> {
    try {
      console.log('⬇️ Downloading audio from:', url);

      // 配置代理（如果有）
      const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
      const axiosConfig: any = {
        responseType: 'arraybuffer',
        timeout: 300000, // 5分钟超时（大视频可能需要更长时间）
        maxContentLength: 100 * 1024 * 1024, // 100MB 最大
        onDownloadProgress: (progressEvent: any) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`   📥 Download progress: ${percentCompleted}% (${(progressEvent.loaded / 1024 / 1024).toFixed(2)}MB)`);
          }
        }
      };

      if (proxyUrl) {
        axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl);
        axiosConfig.httpAgent = new HttpsProxyAgent(proxyUrl);
      }

      const startTime = Date.now();
      const response = await axios.get(url, axiosConfig);
      const downloadTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`✅ Download complete in ${downloadTime}s, size: ${(response.data.length / 1024 / 1024).toFixed(2)}MB`);
      return Buffer.from(response.data);
    } catch (error) {
      console.error('❌ Download error:', error);
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('视频下载超时（超过5分钟）。请检查视频URL是否有效，或尝试更小的视频文件（建议<50MB）。');
        } else if (error.response) {
          throw new Error(`下载失败: HTTP ${error.response.status} - ${error.response.statusText}`);
        } else if (error.request) {
          throw new Error('无法访问视频URL，请检查网络连接或URL是否有效');
        }
      }
      throw new Error(`Failed to download audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 分析转录文本的语言特征
   */
  analyzeTranscription(text: string): {
    wordCount: number;
    sentenceCount: number;
    averageWordsPerSentence: number;
    uniqueWords: number;
  } {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const uniqueWords = new Set(words);

    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      averageWordsPerSentence: sentences.length > 0 ? words.length / sentences.length : 0,
      uniqueWords: uniqueWords.size,
    };
  }
}

