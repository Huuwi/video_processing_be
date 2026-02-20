import { Injectable } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class MinioService {
  private readonly client: Minio.Client;
  private readonly bucketName = 'videos';

  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: Number.parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true' || false,
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });
  }

  async getPresignedPutUrl(objectKey: string, expirySeconds: number = 3600): Promise<string> {
    let url = await this.client.presignedPutObject(this.bucketName, objectKey, expirySeconds);

    const publicUrl = process.env.MINIO_PUBLIC_URL;
    if (publicUrl) {
      const minioEndpoint = process.env.MINIO_ENDPOINT || 'localhost';
      const minioPort = process.env.MINIO_PORT || '9000';
      const internalPrefix = `http://${minioEndpoint}:${minioPort}/${this.bucketName}`;
      url = url.replace(internalPrefix, publicUrl);
    }

    return url;
  }

  async getPresignedUrl(objectKey: string, expirySeconds: number = 3600, filename?: string): Promise<string> {
    const reqParams: { [key: string]: any } = {};
    if (filename) {
      reqParams['response-content-disposition'] = `attachment; filename="${filename}"`;
    }
    let url = await this.client.presignedGetObject(this.bucketName, objectKey, expirySeconds, reqParams);
    
    // If MINIO_PUBLIC_URL is set, replace the internal endpoint and bucket prefix
    const publicUrl = process.env.MINIO_PUBLIC_URL;
    if (publicUrl) {
      const minioEndpoint = process.env.MINIO_ENDPOINT || 'localhost';
      const minioPort = process.env.MINIO_PORT || '9000';
      const internalPrefix = `http://${minioEndpoint}:${minioPort}/${this.bucketName}`;
      url = url.replace(internalPrefix, publicUrl);
    }
    
    return url;
  }

  async uploadFile(objectKey: string, fileBuffer: Buffer, contentType: string): Promise<void> {
    await this.client.putObject(this.bucketName, objectKey, fileBuffer, fileBuffer.length, {
      'Content-Type': contentType,
    });
  }

  async getFileStream(objectKey: string): Promise<NodeJS.ReadableStream> {
    return await this.client.getObject(this.bucketName, objectKey);
  }

  async deleteFile(objectKey: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucketName, objectKey);
    } catch (error) {
       console.error(`Error deleting file ${objectKey}:`, error);
       // Throw error or handle as needed
    }
  }
}
