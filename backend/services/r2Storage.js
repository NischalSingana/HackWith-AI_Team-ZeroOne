/**
 * Cloudflare R2 Upload Service
 * ==============================
 * S3-compatible storage for FIR PDFs.
 *
 * Env vars needed:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_PUBLIC_URL (optional — for public access)
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

function firstEnv(keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
  }
  return undefined;
}

// Initialize R2 client (S3-compatible)
function getR2Client() {
  const accountId = firstEnv(['R2_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID']);
  const accessKeyId = firstEnv(['R2_ACCESS_KEY_ID', 'R2_ACCESS_KEY', 'CLOUDFLARE_R2_ACCESS_KEY_ID']);
  const secretAccessKey = firstEnv(['R2_SECRET_ACCESS_KEY', 'R2_SECRET_KEY', 'CLOUDFLARE_R2_SECRET_ACCESS_KEY']);

  if (!accountId) {
    console.warn('⚠️  R2_ACCOUNT_ID not set — PDF uploads will only be stored locally');
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

const BUCKET = firstEnv(['R2_BUCKET_NAME', 'R2_BUCKET', 'CLOUDFLARE_R2_BUCKET']) || 'fir-analysis-pdfs';

/**
 * Upload a file to R2
 * @param {string} localFilePath - Path to the local file
 * @param {string} originalName - Original filename
 * @returns {Promise<{success: boolean, key: string, url: string}>}
 */
async function uploadToR2(localFilePath, originalName) {
  const client = getR2Client();
  const accountId = firstEnv(['R2_ACCOUNT_ID', 'CLOUDFLARE_ACCOUNT_ID']);
  if (!client) {
    return { success: false, key: null, url: localFilePath, error: 'R2 not configured' };
  }

  try {
    const fileBuffer = fs.readFileSync(localFilePath);
    const timestamp = Date.now();
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `fir-pdfs/${timestamp}-${sanitizedName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: 'application/pdf',
      Metadata: {
        'original-name': originalName,
        'upload-date': new Date().toISOString(),
      },
    });

    await client.send(command);

    // Build the public URL
    const publicBase = firstEnv(['R2_PUBLIC_URL', 'R2_PUBLIC_BASE_URL', 'CLOUDFLARE_R2_PUBLIC_URL']);
    const publicUrl = publicBase
      ? `${publicBase}/${key}`
      : `https://${BUCKET}.${accountId}.r2.cloudflarestorage.com/${key}`;

    console.log(`☁️  Uploaded to R2: ${key}`);

    return { success: true, key, url: publicUrl };
  } catch (err) {
    console.error('❌ R2 upload error:', err.message);
    return { success: false, key: null, url: localFilePath, error: err.message };
  }
}

/**
 * Delete a file from R2
 * @param {string} key - R2 object key
 */
async function deleteFromR2(key) {
  const client = getR2Client();
  if (!client || !key) return;

  try {
    await client.send(new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));
    console.log(`🗑️  Deleted from R2: ${key}`);
  } catch (err) {
    console.error('❌ R2 delete error:', err.message);
  }
}

/**
 * Get a readable stream for a file from R2
 * @param {string} key - R2 object key
 * @returns {Promise<ReadableStream>}
 */
async function getFileStream(key) {
  const client = getR2Client();
  if (!client || !key) return null;

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    const response = await client.send(command);
    return response.Body; // Retrieve the readable stream
  } catch (err) {
    console.error('❌ R2 download error:', err.message);
    return null;
  }
}

/**
 * List all files in R2 bucket under a prefix
 * @param {string} prefix - Key prefix to filter (default: 'fir-pdfs/')
 * @returns {Promise<Array<{key: string, size: number, lastModified: Date}>>}
 */
async function listR2Files(prefix = 'fir-pdfs/') {
  const client = getR2Client();
  if (!client) return [];

  try {
    const allFiles = [];
    let continuationToken = undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const response = await client.send(command);
      
      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key && obj.Key.toLowerCase().endsWith('.pdf')) {
            allFiles.push({
              key: obj.Key,
              size: obj.Size,
              lastModified: obj.LastModified,
            });
          }
        }
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    console.log(`📋 Found ${allFiles.length} PDFs in R2 bucket (prefix: ${prefix})`);
    return allFiles;
  } catch (err) {
    console.error('❌ R2 list error:', err.message);
    return [];
  }
}

/**
 * Download a file from R2 to a local temp path
 * @param {string} key - R2 object key
 * @param {string} localDir - Local directory to save to
 * @returns {Promise<{success: boolean, localPath: string, originalName: string}>}
 */
async function downloadR2ToLocal(key, localDir = '/tmp') {
  const client = getR2Client();
  if (!client || !key) return { success: false };

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    const response = await client.send(command);
    const fileName = path.basename(key);
    const localPath = path.join(localDir, fileName);

    // Ensure directory exists
    fs.mkdirSync(localDir, { recursive: true });

    // Write stream to file
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    fs.writeFileSync(localPath, Buffer.concat(chunks));

    console.log(`⬇️  Downloaded: ${key} → ${localPath}`);
    return { success: true, localPath, originalName: fileName };
  } catch (err) {
    console.error(`❌ R2 download error for ${key}:`, err.message);
    return { success: false, localPath: null, originalName: null };
  }
}

module.exports = { uploadToR2, deleteFromR2, getFileStream, listR2Files, downloadR2ToLocal };
