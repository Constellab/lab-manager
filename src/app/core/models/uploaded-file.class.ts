/**
 * Type to use on uploaded file
 */
export interface UploadedFileI {
  originalname: string;
  // encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
  // name?: string;
}
