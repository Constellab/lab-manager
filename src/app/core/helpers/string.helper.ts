/**
 * Helper class with only static methods to simplify String management
 */
export class StringHelper {

  /**
   * Generate an UUID v4, it is not a simple uuid ID and must not used for encryption
   */
  public static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }


  /**
   * @param file filename or full file path
   * @return the file extension without the .
   */
  public static getFileExtension(file: string): string {
    if (!file) return null;
    return StringHelper.extractFilenameFromFullPath(file)
      .split('.')
      .slice(-1)
      .join('.');
  }

  /**
   * @param fullPath full path of the file
   * @return the filename of a path with the extension
   */
  public static extractFilenameFromFullPath(fullPath: string): string {
    // use a new RegExp otherwise the ngc build doesn't works
    const regex = new RegExp(/^.*[/]/);
    return fullPath.replace(regex, '');
  }
}
