const fileToBlob = (file: File): Promise<Blob> =>
  new Promise((resolve: (value: Blob | PromiseLike<Blob>) => void): void => {
    const reader: FileReader = new FileReader();
    let buffer: Uint8Array | null = null;
    const chunkSize: number = 1024 * 1024;

    reader.onload = (): void => {
      if (buffer === null) {
        buffer = new Uint8Array(reader.result as ArrayBuffer);
      } else {
        const currentBuffer: Uint8Array = new Uint8Array(
          reader.result as ArrayBuffer
        );
        const newBuffer: Uint8Array = new Uint8Array(
          buffer.length + currentBuffer.length
        );
        newBuffer.set(buffer);
        newBuffer.set(currentBuffer, buffer.length);
        buffer = newBuffer;
      }

      if (buffer.length < file.size) {
        readNextChunk(buffer.length);
      } else {
        resolve(new Blob([buffer.buffer], { type: file.type }));
      }
    };

    const readNextChunk = (start: number): void => {
      const end: number = Math.min(start + chunkSize, file.size);
      const chunk: Blob = file.slice(start, end);
      reader.readAsArrayBuffer(chunk);
    };

    readNextChunk(0);
  });

export default fileToBlob;
