export interface TransformerDTO {
  id: string;
  name: string;
  description: string;
  inputType: string;
  outputType: string;
  code: string;
}

export interface TransformerCommand {
  name: string;
  description: string;
  inputType: string;
  outputType: string;
  code: string;
}

export interface TransformerSearchParam {
  name?: string;
  inputType?: string;
  outputType?: string;
}
