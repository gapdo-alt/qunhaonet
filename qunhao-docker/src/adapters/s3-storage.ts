import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

export interface StoredObject {
  body: ReadableStream<Uint8Array> | Readable;
  httpEtag: string;
  contentType?: string;
}

export interface ObjectStorage {
  get(key: string): Promise<StoredObject | null>;
  put(key: string, body: Buffer | string | ReadableStream<Uint8Array>, options?: { contentType?: string }): Promise<void>;
  delete(keys: string[]): Promise<void>;
  ping(): Promise<boolean>;
}

function streamToWeb(stream: Readable): ReadableStream<Uint8Array> {
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

function toBuffer(body: Buffer | string | ReadableStream<Uint8Array>): Buffer | ReadableStream<Uint8Array> {
  if (typeof body === 'string') return Buffer.from(body, 'utf8');
  return body;
}

export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
}

export function createObjectStorage(config: S3Config): ObjectStorage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: true,
  });

  const bucket = config.bucket;

  return {
    async get(key) {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!res.Body) return null;
        const stream = res.Body as Readable;
        return {
          body: streamToWeb(stream),
          httpEtag: res.ETag ?? `"${key}"`,
          contentType: res.ContentType,
        };
      } catch (e: unknown) {
        const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return null;
        throw e;
      }
    },

    async put(key, body, options) {
      const payload = toBuffer(body);
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: payload,
          ContentType: options?.contentType,
        }),
      );
    },

    async delete(keys) {
      if (keys.length === 0) return;
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })) },
        }),
      );
    },

    async ping() {
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        return true;
      } catch {
        return false;
      }
    },
  };
}

export async function ensureBucket(config: S3Config): Promise<void> {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
    forcePathStyle: true,
  });

  try {
    await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
  }
}

export function writeHttpMetadata(headers: Headers, obj: StoredObject): void {
  if (obj.contentType) headers.set('content-type', obj.contentType);
}
