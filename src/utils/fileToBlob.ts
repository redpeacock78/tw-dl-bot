/**
 * Converts a File object to a Blob object asynchronously.
 *
 * @param {File} file - The File object to convert.
 * @return {Promise<Blob>} A Promise that resolves to the converted Blob object.
 */
const fileToBlob = (file: File): Promise<Blob> =>
  new Promise((resolve: (value: Blob | PromiseLike<Blob>) => void): void => {
    const reader: FileReader = new FileReader();
    /**
     * Handles the event when the FileReader has loaded a file successfully and resolves a Blob object.
     *
     * @return {void} No return value.
     */
    reader.onload = (): void => {
      resolve(new Blob([reader.result as ArrayBuffer], { type: file.type }));
    };
    reader.readAsArrayBuffer(file);
  });

export default fileToBlob;
