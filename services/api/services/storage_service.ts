import OSS from 'ali-oss';
import { ENV } from '../_core/env.js';

export interface UploadResult {
  publicUrl: string;
  filePath: string;
  bucket: string;
}

export interface DeleteResult {
  deleted: string[];
}

interface OssFileObject {
  name: string;
  size?: number;
  url?: string;
  metadata?: { size?: number; mimetype?: string };
  [k: string]: any;
}

/**
 * 对象存储服务（阿里云 OSS）。
 *
 * 对外方法签名保持与原 Supabase Storage 版本一致（upload/delete/list/getPublicUrl），
 * 内部换成 ali-oss，调用方只需去掉构造参数。
 *
 * - `filePath` 统一存 OSS object key（如 `imports/123_abc.xlsx`），不再存完整 URL。
 * - `publicUrl` 由 getPublicUrl 推导：优先 OSS_CDN_DOMAIN，否则走 OSS 默认外网域名。
 */
export class StorageService {
  private client: OSS;
  private bucket: string;

  constructor() {
    this.bucket = ENV.ossBucket;
    this.client = new OSS({
      region: ENV.ossRegion,
      accessKeyId: ENV.ossAccessKeyId,
      accessKeySecret: ENV.ossAccessKeySecret,
      bucket: ENV.ossBucket,
      ...(ENV.ossEndpoint ? { endpoint: ENV.ossEndpoint } : {}),
      // 上传结果里的 url 字段需要 secure:true 才会是 https
      secure: true,
    });
  }

  /**
   * 上传文件到 OSS。
   * 返回标准化结果：filePath=object key，publicUrl=可访问的完整 URL。
   */
  async upload(
    filePath: string,
    fileBuffer: Buffer,
    contentType: string,
    _bucketSuffix?: string,
    _upsert: boolean = true,
  ): Promise<UploadResult> {
    const result = await this.client.put(filePath, fileBuffer, {
      mime: contentType,
      headers: { 'Content-Type': contentType },
    });

    if (!result?.name) {
      throw new Error('Upload failed: OSS 未返回对象名');
    }

    return {
      publicUrl: this.getPublicUrl(result.name),
      filePath: result.name,
      bucket: this.bucket,
    };
  }

  /**
   * 批量删除文件。
   */
  async delete(filePaths: string[], _bucketSuffix?: string): Promise<DeleteResult> {
    if (filePaths.length === 0) return { deleted: [] };
    const result = await this.client.deleteMulti(filePaths);
    const deleted = (result.deleted || []).map((item: any) => item.name);
    return { deleted };
  }

  /**
   * 列出指定前缀下的文件。
   */
  async list(folderPath: string = '', _bucketSuffix?: string) {
    const prefix = folderPath ? `${folderPath.replace(/\/$/, '')}/` : '';
    const result = await this.client.list({ prefix, 'max-keys': 100 }, {});

    const files: OssFileObject[] = (result.objects || []) as OssFileObject[];
    return files
      .filter((file) => file.name !== prefix) // 过滤掉目录占位符自身
      .map((file) => {
        const name = file.name.split('/').pop() || file.name;
        return {
          name,
          size: file.size ?? file.metadata?.size,
          contentType: file.metadata?.mimetype,
          publicUrl: this.getPublicUrl(file.name),
        };
      });
  }

  /**
   * 由 object key 推导可访问 URL。
   * 优先 OSS_CDN_DOMAIN（自定义域名/CDN），否则用 OSS 默认外网域名。
   * 注：filePath 入参既可能是 object key，也可能是历史完整 URL——后者原样返回。
   */
  getPublicUrl(filePath: string, _bucketSuffix?: string): string {
    if (/^https?:\/\//i.test(filePath)) return filePath;

    if (ENV.ossCdnDomain) {
      const base = ENV.ossCdnDomain.replace(/\/$/, '');
      return `${base}/${filePath.replace(/^\//, '')}`;
    }

    // 走 OSS 默认外网域名：https://{bucket}.{endpoint 去协议}/{key}
    const endpoint = (ENV.ossEndpoint || `https://${ENV.ossRegion}.aliyuncs.com`).replace(/^https?:\/\//, '');
    return `https://${this.bucket}.${endpoint}/${filePath.replace(/^\//, '')}`;
  }
}
