export interface HandlesFile {
  handleFile(filePath: string): Promise<void>;
}

export interface HandlesValues {
  handleValues(values: Array<any>): Promise<void>;
}
