import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';

dotenv.config();

const s3Config = {
  region: process.env.AWS_REGION || 'ap-south-1',
};

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3Config.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

const s3Client = new S3Client(s3Config);

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

/**
 * Upload a file buffer to S3.
 */
export async function uploadToS3(fileBuffer, key, contentType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
  return key;
}

/**
 * Delete a single object from S3.
 */
export async function deleteFromS3(keyOrUrl) {
  const key = extractKey(keyOrUrl);
  if (!key) return;

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Delete all objects under a given prefix (i.e. delete a "folder" in S3).
 */
export async function deleteFolderFromS3(prefix) {
  if (!prefix) return;

  // List all objects with the prefix
  const listCommand = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  });

  const listed = await s3Client.send(listCommand);

  if (!listed.Contents || listed.Contents.length === 0) return;

  const deleteCommand = new DeleteObjectsCommand({
    Bucket: BUCKET_NAME,
    Delete: {
      Objects: listed.Contents.map((obj) => ({ Key: obj.Key })),
      Quiet: true,
    },
  });

  await s3Client.send(deleteCommand);
}

/**
 * Generate a pre-signed URL for an S3 object.
 */
export async function getPresignedUrl(keyOrUrl, expiresIn = 3600) {
  const key = extractKey(keyOrUrl);

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Extract the S3 key from a key or full URL.
 */
function extractKey(keyOrUrl) {
  if (!keyOrUrl) return null;
  if (keyOrUrl.startsWith('https://')) {
    try {
      const url = new URL(keyOrUrl);
      return decodeURIComponent(url.pathname.slice(1));
    } catch {
      return keyOrUrl;
    }
  }
  return keyOrUrl;
}

export default s3Client;
