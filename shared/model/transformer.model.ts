export interface TransformerDTO {
  id: string;
  inputType: string;
  outputType: string;
  code: string;
  fileRegex: string | null;
}

export interface TransformerCommandDTO extends Omit<TransformerDTO, 'id'> {}
