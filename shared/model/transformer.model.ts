export interface TransformerDTO {
  id: string;
  name: string;
  description: string | null;
  inputType: string;
  outputType: string;
  code: string;
  fileRegex: string | null;
}

export interface TransformerFilterDTO extends Partial<Pick<TransformerDTO, 'inputType' | 'outputType' | 'name'>> {}

export interface TransformerCommandDTO extends Omit<TransformerDTO, 'id'> {}
