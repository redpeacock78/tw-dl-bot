const fileToBlob = (file: File): Promise<Blob> =>
  new Promise((resolve: (value: Blob | PromiseLike<Blob>) => void): void => {
    const reader: FileReader = new FileReader();
    reader.onload = (): void => {
      resolve(new Blob([reader.result as ArrayBuffer], { type: file.type }));
    };
    reader.readAsArrayBuffer(file);
  });

export default fileToBlob;
