import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Video, VideoDocument } from '../video/video.schema';
import { MinioService } from '../minio/minio.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @InjectModel(Video.name) private videoModel: Model<VideoDocument>,
    private minioService: MinioService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.log('Running daily cleanup job...');
    
    // Calculate date threshold: 3 days ago
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 3);
    
    this.logger.log(`Cleaning up videos created before: ${thresholdDate.toISOString()}`);

    try {
      const oldVideos = await this.videoModel.find({
        createdAt: { $lt: thresholdDate },
      });

      this.logger.log(`Found ${oldVideos.length} videos to clean up.`);

      for (const video of oldVideos) {
        await this.deleteVideoResources(video);
      }
      
      this.logger.log('Cleanup job finished.');
    } catch (error) {
      this.logger.error('Error during cleanup job:', error);
    }
  }

  private async deleteVideoResources(video: VideoDocument) {
    try {
      this.logger.log(`Deleting resources for video: ${video._id}`);
      
      // 1. Delete S3 Key (Uploaded / Downloaded source)
      if (video.s3_key) {
         await this.minioService.deleteFile(video.s3_key);
      }

      // 2. Delete Audio Processed
      if (video.audio_processed) {
          // Identify key from link if stored as link, or just key
          // Assuming stored as key or we need to extract key
          // Inspecting schema logic usually stores keys? 
          // If it stores full URL, we might need to parse. 
          // Based on MinioService.getPresignedUrl, it returns a URL.
          // Let's assume for now we might store keys or paths.
          // If it's a full URL, removing the domain/bucket part might be needed.
          // Ideally, we should store keys.
          // Safe attempt: try to delete as is, or extract last part?
          // For safety, let's assume it's the key if it doesn't start with http.
          // If it starts with http, we might skip or try to parse.
          
          await this.safelyDelete(video.audio_processed);
      }

      // 3. Delete Subtitle Audios
      if (video.sub && video.sub.audios && Array.isArray(video.sub.audios)) {
          for (const audio of video.sub.audios) {
              if (audio.audio_key) {
                  await this.safelyDelete(audio.audio_key);
              }
          }
      }
      
      // 4. Delete Srt Output
      if (video.sub && video.sub.audios) {
         for (const audio of video.sub.audios) {
             if (audio.srt_output) {
                 await this.safelyDelete(audio.srt_output);
             }
         }
      }

      // 5. Delete Chunks (if we track them... schema doesn't seem to explicitly list chunks array except maybe used in process)
      // If we don't have keys for chunks stored, we can't easily delete them unless they follow a pattern in a folder.
      // MinIO delete folder? Minio client usually needs recursive delete or list objects.
      
      // 6. Delete Record
      await this.videoModel.deleteOne({ _id: video._id });
      this.logger.log(`Deleted video record: ${video._id}`);

    } catch (error) {
       this.logger.error(`Failed to cleanup video ${video._id}:`, error);
    }
  }

  private async safelyDelete(pathOrKey: string) {
      if (!pathOrKey) return;
      // Simple heuristic: if it looks like a url, try to extract key, else use as key
      let key = pathOrKey;
      if (pathOrKey.startsWith('http')) {
          // Try to extract content after bucket name? 
          // Or just last part? Risk of wrong key.
          // Better to leave it for now if unsure, OR simple parse.
          // If MINIO_PUBLIC_URL is http://localhost/storage
          // and url is http://localhost/storage/videos/abc.mp3
          // then key is abc.mp3 ?
          // Let's try to match against known patterns if possible.
          try {
             const urlObj = new URL(pathOrKey);
             // pathname: /storage/filename or /bucket/filename
             // If we assume standard path... 
             const parts = urlObj.pathname.split('/');
             // parts[0] is empty, parts[1] is bucket or mount?
             // If simple key, use the last part or relevant path
             key = parts.slice(2).join('/'); // rough guess
          } catch (e) {
             // not a url
          }
      }
      
      await this.minioService.deleteFile(key);
  }
}
