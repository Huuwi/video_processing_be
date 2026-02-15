import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Video, VideoStatus, VideoStage } from './video.schema';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { MinioService } from '../minio/minio.service';
import { EditPresetService } from '../edit-preset/edit-preset.service';

@Injectable()
export class VideoService {
  constructor(
    @InjectModel(Video.name) private readonly videoModel: Model<Video>,
    private readonly rabbitMQService: RabbitMQService,
    private readonly minioService: MinioService,
    private readonly editPresetService: EditPresetService,
  ) {}

  async createVideos(urls: string[], userId: string, userEmail?: string): Promise<Video[]> {
    const videos: Video[] = [];
    const now = new Date();
    // Format YYYY-MM-DD HH:mm:ss in Vietnam Time
    const dateStr = now.toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).replace('T', ' ');
    const baseTitle = userEmail ? `${userEmail} - ${dateStr}` : `Video - ${dateStr}`;

    for (const [index, url] of urls.entries()) {
      const title = urls.length > 1 ? `${baseTitle} (${index + 1})` : baseTitle;
      const newVideo = new this.videoModel({
        userId,
        url,
        title: title,
        status: VideoStatus.PENDING,
        stage: VideoStage.DOWNLOAD,
      });
      const savedVideo = await newVideo.save();
      videos.push(savedVideo);

      // Publish to RabbitMQ
      await this.rabbitMQService.sendToQueue('topic_download', {
        videoId: savedVideo._id,
        url: savedVideo.url,
      });
    }
    return videos;
  }

  async findAll(
    userId: string, 
    query: { 
      page?: number; 
      limit?: number; 
      search?: string; 
      status?: VideoStatus; 
      stage?: VideoStage; 
    },
    projection?: Record<string, number>
  ): Promise<{ data: Video[]; total: number; page: number; totalPages: number }> {
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 10;
      const skip = (page - 1) * limit;

      const filter: any = { userId };
      
      if (query.status) {
          filter.status = query.status;
      }
      
      if (query.stage) {
          filter.stage = query.stage;
      }

      if (query.search) {
          filter.title = { $regex: query.search, $options: 'i' };
      }

      const dbQuery = this.videoModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);
      if (projection) {
          dbQuery.select(projection);
      }

      const [data, total] = await Promise.all([
          dbQuery.exec(),
          this.videoModel.countDocuments(filter).exec()
      ]);

      return {
          data,
          total,
          page,
          totalPages: Math.ceil(total / limit)
      };
  }

  async findByUser(userId: string, projection?: Record<string, number>): Promise<Video[]> {
    const query = this.videoModel.find({ user: userId }).sort({ createdAt: -1 });
    if (projection) {
      query.select(projection);
    }
    return query.exec();
  }

  async findOne(id: string): Promise<Video | null> {
      return this.videoModel.findById(id).exec();
  }

  async updateVideo(id: string, updates: { title?: string }): Promise<Video | null> {
    return this.videoModel.findByIdAndUpdate(id, updates, { new: true }).exec();
  }

  async saveEditConfig(id: string, config: any): Promise<Video | null> {
    const { language, voice_code, ...editingMeta } = config;
    const video = await this.videoModel.findByIdAndUpdate(
      id,
      {
        user_editing_meta: editingMeta,
        language: language || 'vietnamese',
        voice_code: voice_code || '',
        stage: VideoStage.AI_PROCESS,
        status: VideoStatus.IN_PROGRESS,
      },
      { new: true },
    );

    if (video) {
        // Publish events cho từng audio chunk (như Python service)
        const audioCollection = this.videoModel.db.collection('audios');
        const audioDocs = await audioCollection.find({ video_id: id }).sort({ file_index: 1 }).toArray();
        
        for (const audioDoc of audioDocs) {
          await this.rabbitMQService.sendToQueue('topic_ai_process', {
            audio_id: audioDoc._id.toString(),
            video_id: id,
            audio_key: audioDoc.audio_key,
            file_index: audioDoc.file_index
          });
        }
    }

    return video;
  }

  async handleN8nComplete(videoId: string, audioKey: string): Promise<Video | null> {
      const video = await this.videoModel.findByIdAndUpdate(
          videoId,
          {
              audio_processed: audioKey,
              stage: VideoStage.EDIT_PROCESS
          },
          { new: true }
      );

      if (video) {
        await this.rabbitMQService.sendToQueue('topic_edit_process', {
            videoId: video._id,
        });
      }

      return video;
  }

  async generateSamplePresignedUrl(videoId: string): Promise<{ url: string; expiresAt: string }> {
    const video = await this.videoModel.findById(videoId).exec();
    if (!video || !video.sub?.sample) {
      throw new Error('Video sample not found');
    }

    const url = await this.minioService.getPresignedUrl(video.sub.sample, 3600); // 1 hour
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    return { url, expiresAt };
  }

  async generateDownloadPresignedUrl(videoId: string): Promise<{ url: string; expiresAt: string }> {
    const video = await this.videoModel.findById(videoId).exec();
    if (!video || !video.download_link) {
      throw new Error('Video download link not found');
    }

    const filename = video.title 
      ? `${video.title.replace(/[^a-z0-9]/gi, '_')}.mp4`
      : `video_${video._id}.mp4`;

    const url = await this.minioService.getPresignedUrl(video.download_link, 3600, filename); // 1 hour
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    return { url, expiresAt };
  }

  async getSrtContent(id: string): Promise<string> {
    const video = await this.videoModel.findById(id);
    if (!video) throw new Error('Video not found');
    return video.sub?.srt_concatenated || '';
  }

  async retryVideo(videoId: string): Promise<Video | null> {
    const video = await this.videoModel.findByIdAndUpdate(
      videoId,
      {
        status: VideoStatus.PENDING,
        stage: VideoStage.DOWNLOAD,
        $unset: { audio_processed: "", error: "" } // Clear error and previous results
      },
      { new: true }
    );

    if (video) {
      await this.rabbitMQService.sendToQueue('topic_download', {
        videoId: video._id,
        url: video.url,
      });
    }

    return video;
  }

  async uploadLogo(videoId: string, fileBuffer: Buffer, filename: string): Promise<{ fileKey: string }> {
    const ext = filename.split('.').pop();
    const timestamp = Date.now();
    const fileKey = `logos/${videoId}/${timestamp}.${ext}`;
    
    const contentType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
    
    await this.minioService.uploadFile(fileKey, fileBuffer, contentType);
    
    return { fileKey };
  }

  async autoEditVideos(videoIds: string[]): Promise<{ success: boolean; processedCount: number }> {
    let processedCount = 0;
    
    for (const videoId of videoIds) {
      const video = await this.videoModel.findById(videoId).exec();
      
      // Allow auto-edit for both DOWNLOAD and USER_EDITING stages
      if (!video || (video.stage !== VideoStage.USER_EDITING && video.stage !== VideoStage.DOWNLOAD)) {
        continue;
      }

      // Determine aspect ratio based on duration (2 minutes = 120,000 ms)
      const durationMs = (video as any).original_duration_ms || 0;
      const aspectRatio = durationMs > 120000 ? '16:9' : '9:16';

      const defaultConfig = {
        logo: undefined,
        subtitle: {
          color: '#FFFFFF',
          bg_color: '#000000',
          position: 'bottom',
          position_x: 0,
          position_y: 90,
          font_size: 21,
          width_percent: 100,
        },
        resize_mode: aspectRatio
      };

      // If video is still downloading, just mark auto_edit flag
      // Python service will auto-publish after download completes
      if (video.stage === VideoStage.DOWNLOAD) {
        await this.videoModel.findByIdAndUpdate(videoId, {
          user_editing_meta: defaultConfig,
          language: 'vietnamese',
          voice_code: '',
          auto_edit: true
        });
        processedCount++;
        continue;
      }

      // For USER_EDITING stage, proceed immediately
      await this.videoModel.findByIdAndUpdate(videoId, {
        user_editing_meta: defaultConfig,
        language: 'vietnamese',
        voice_code: '',
        auto_edit: true,
        stage: VideoStage.AI_PROCESS,
        status: VideoStatus.IN_PROGRESS
      });

      // Publish events for each audio chunk (like Python service does)
      // Query audio collection to get all audio parts for this video
      const audioCollection = this.videoModel.db.collection('audios');
      const audioDocs = await audioCollection.find({ video_id: videoId }).sort({ file_index: 1 }).toArray();
      
      for (const audioDoc of audioDocs) {
        await this.rabbitMQService.sendToQueue('topic_ai_process', {
          audio_id: audioDoc._id.toString(),
          video_id: videoId,
          audio_key: audioDoc.audio_key,
          file_index: audioDoc.file_index
        });
      }

      processedCount++;
    }

    return { success: true, processedCount };
  }

  async batchEditVideos(videoIds: string[], editConfig: any): Promise<{ success: boolean; processedCount: number }> {
    let processedCount = 0;
    
    for (const videoId of videoIds) {
      const video = await this.videoModel.findById(videoId).exec();
      
      // Allow batch edit for both downloading and user_editing stages
      if (!video || (video.stage !== VideoStage.DOWNLOAD && video.stage !== VideoStage.USER_EDITING)) {
        continue;
      }

      // Determine aspect ratio based on duration (2 minutes = 120,000 ms)
      const durationMs = (video as any).original_duration_ms || 0;
      const aspectRatio = durationMs > 120000 ? '16:9' : '9:16';
      
      const configWithRatio = {
        ...editConfig,
        resize_mode: aspectRatio
      };

      const { language, voice_code, ...metaOnly } = configWithRatio;

      // If video is still downloading, just mark batch_edit flag
      // Python service will auto-publish after download completes
      if (video.stage === VideoStage.DOWNLOAD) {
        await this.videoModel.findByIdAndUpdate(videoId, {
          user_editing_meta: metaOnly,
          language: language || 'vietnamese',
          voice_code: voice_code || '',
          batch_edit: true
        });
        processedCount++;
        continue;
      }

      // For USER_EDITING stage, proceed immediately
      await this.videoModel.findByIdAndUpdate(videoId, {
        user_editing_meta: metaOnly,
        language: language || 'vietnamese',
        voice_code: voice_code || '',
        batch_edit: true,
        stage: VideoStage.AI_PROCESS,
        status: VideoStatus.IN_PROGRESS
      });

      // Publish events for each audio chunk (like Python service does)
      const audioCollection = this.videoModel.db.collection('audios');
      const audioDocs = await audioCollection.find({ video_id: videoId }).sort({ file_index: 1 }).toArray();
      
      for (const audioDoc of audioDocs) {
        await this.rabbitMQService.sendToQueue('topic_ai_process', {
          audio_id: audioDoc._id.toString(),
          video_id: videoId,
          audio_key: audioDoc.audio_key,
          file_index: audioDoc.file_index
        });
      }

      processedCount++;
    }

    return { success: true, processedCount };
  }

  async applyPresetToVideos(userId: string, videoIds: string[], presetId: string): Promise<any> {
    // 1. Get preset
    const presetDoc = await this.editPresetService.findOne(presetId, userId);
    if (!presetDoc) {
      throw new Error('Preset not found');
    }
    // Convert Mongoose document to plain object
    const presetConfig = JSON.parse(JSON.stringify(presetDoc.config || {}));

    let processedCount = 0;
    const errors: string[] = [];

    for (const videoId of videoIds) {
      try {
        const video = await this.videoModel.findOne({ _id: videoId, userId });
        if (!video) continue;

        // Extract language/voice_code from config (top-level or from subtitle for old format)
        const language = presetConfig.language || presetConfig.subtitle?.language || 'vietnamese';
        const voice_code = presetConfig.voice_code || '';
        
        const editConfig = {
          logo: presetConfig.logo || undefined,
          subtitle: presetConfig.subtitle,
          resize_mode: presetConfig.resize_mode
        };

        // If video is still downloading, just mark auto_edit flag
        if (video.stage === VideoStage.DOWNLOAD) {
          await this.videoModel.findByIdAndUpdate(videoId, {
            user_editing_meta: editConfig,
            language: language || 'vietnamese',
            voice_code: voice_code || '',
            auto_edit: true
          });
          processedCount++;
          continue;
        }

        // For USER_EDITING stage, proceed immediately
        await this.videoModel.findByIdAndUpdate(videoId, {
          user_editing_meta: editConfig,
          language: language || 'vietnamese',
          voice_code: voice_code || '',
          auto_edit: true,
          stage: VideoStage.AI_PROCESS,
          status: VideoStatus.IN_PROGRESS
        });

        // Get audios using direct collection access
        const audioCollection = this.videoModel.db.collection('audios');
        const audios = await audioCollection.find({ video_id: videoId }).toArray();
        
        if (!audios || audios.length === 0) {
           errors.push(`No audios found for video ${videoId}`);
           continue;
        }

        // Publish events for each audio chunk
        for (const [index, audio] of audios.entries()) {
          const event = {
            video_id: videoId,
            audio_id: audio._id.toString(),
            audio_key: audio.audio_key,
            file_index: index,
            status: "pending",
          };
          
          await this.rabbitMQService.sendToQueue('topic_ai_process', event);
        }
        
        processedCount++;

      } catch (err) {
        errors.push(`Failed to process video ${videoId}: ${err.message}`);
      }
    }

    return {
      processed: processedCount,
      errors
    };
  }

  async cancelAutoEdit(videoId: string, userId: string): Promise<Video | null> {
    const video = await this.videoModel.findOne({ _id: videoId, userId });
    
    if (!video) {
       throw new Error('Video not found or access denied');
    }

    // Only allow cancellation if video is in DOWNLOAD stage (before AI process)
    if (video.stage !== VideoStage.DOWNLOAD) {
       throw new Error('Reference video is already processed or in wrong stage to cancel auto-edit');
    }

    return this.videoModel.findByIdAndUpdate(
      videoId,
      {
        auto_edit: false,
        batch_edit: false,
        $unset: { user_editing_meta: "" } 
      },
      { new: true }
    ).exec();
  }
}
 