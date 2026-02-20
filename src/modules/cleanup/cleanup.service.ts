import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { Video, VideoDocument } from '../video/video.schema';
import { MinioService } from '../minio/minio.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @InjectModel(Video.name) private videoModel: Model<VideoDocument>,
    @InjectConnection() private connection: Connection,
    private minioService: MinioService,
  ) {}

  /**
   * Cron: Runs daily at midnight.
   *
   * Responsibilities:
   * 1. FALLBACK raw file cleanup — for videos where Python service failed to clean
   *    raw files (raw_cleaned = false). Deletes each file individually with try/catch.
   * 2. RETENTION cleanup — for videos older than 3 days:
   *    - Delete final result file from MinIO
   *    - Delete logo from MinIO (only if manual edit: auto_edit = false)
   *    - Delete related `audios` and `voice_chunks` MongoDB records
   *    - Delete the video document itself
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.log('Running daily cleanup job...');

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - 3);

    this.logger.log(`Threshold: videos created before ${thresholdDate.toISOString()}`);

    try {
      const oldVideos = await this.videoModel.find({
        createdAt: { $lt: thresholdDate },
      });

      this.logger.log(`Found ${oldVideos.length} videos to process.`);

      for (const video of oldVideos) {
        await this.processVideoCleanup(video);
      }

      this.logger.log('Cleanup job finished.');
    } catch (error) {
      this.logger.error('Cleanup job failed:', error);
    }
  }

  private async processVideoCleanup(video: VideoDocument) {
    const videoId = (video._id as any).toString();
    this.logger.log(`Cleaning up video: ${videoId}`);

    const db = this.connection.db;
    if (!db) {
      this.logger.error(`MongoDB db unavailable, skipping cleanup for ${videoId}`);
      return;
    }

    try {
      // ── Part 1: FALLBACK raw file cleanup ─────────────────────────────
      // Python already handles this in the happy path and sets raw_cleaned=true.
      // Only run this if Python failed to clean up.
      if (!video.raw_cleaned) {
        this.logger.warn(`raw_cleaned=false for ${videoId}, running fallback raw cleanup.`);
        await this.deleteRawFilesSafely(video);
      }

      // ── Part 2: RETENTION — MinIO files ───────────────────────────────
      // Delete final result file (always)
      await this.safelyDelete(video.download_link, 'download_link');

      // Delete logo only for manual edits (auto_edit=false → user uploaded logo)
      // auto_edit=true → logo belongs to a preset (shared), keep it
      if (!video.auto_edit) {
        const logoKey = (video.user_editing_meta as any)?.logo?.file_key;
        await this.safelyDelete(logoKey, 'logo');

        // Delete bg_music only for manual edits (same pattern as logo)
        const bgMusicKey = (video.user_editing_meta as any)?.bg_music?.file_key;
        await this.safelyDelete(bgMusicKey, 'bg_music');
      }

      // ── Part 3: RETENTION — MongoDB records ───────────────────────────
      // Delete audio chunk records from `audios` collection
      const audiosResult = await db.collection('audios').deleteMany({ video_id: videoId });
      this.logger.log(`Deleted ${audiosResult.deletedCount} audios records for ${videoId}`);

      // Delete TTS voice chunk records from `voice_chunks` collection
      const chunksResult = await db.collection('voice_chunks').deleteMany({ video_id: videoId });
      this.logger.log(`Deleted ${chunksResult.deletedCount} voice_chunks records for ${videoId}`);

      // Delete the video document itself
      await this.videoModel.deleteOne({ _id: video._id });
      this.logger.log(`Deleted video record: ${videoId}`);

    } catch (error) {
      this.logger.error(`Failed to cleanup video ${videoId}:`, error);
    }
  }

  /**
   * Fallback: Delete raw MinIO files for videos where Python cleanup failed.
   * Each file is deleted independently — one failure does NOT stop the rest.
   */
  private async deleteRawFilesSafely(video: VideoDocument) {
    const sub = video.sub as any;
    const rawKeys: (string | undefined)[] = [
      sub?.video_origin_mute,
      sub?.sample,
      sub?.final_audio_key,
      ...(sub?.audios?.map((a: any) => a.audio_key) ?? []),
    ];

    for (const key of rawKeys) {
      await this.safelyDelete(key, 'raw fallback');
    }
  }

  /**
   * Delete a single MinIO file, silently ignoring errors.
   */
  private async safelyDelete(key: string | undefined, label = '') {
    if (!key) return;
    try {
      await this.minioService.deleteFile(key);
      this.logger.log(`Deleted [${label}]: ${key}`);
    } catch (e) {
      this.logger.warn(`Failed to delete [${label}] ${key}: ${e.message}`);
    }
  }
}
