export interface TransformerDTO {
  id: string;
  name: string;
  description: string | null;
  inputType: string;
  outputType: string;
  code: string;
  fileRegex: string | null;
}

export type TransformerFilterDTO = Partial<Pick<TransformerDTO, 'inputType' | 'outputType' | 'name'>>;

export type TransformerCommandDTO = Omit<TransformerDTO, 'id'>;
