type TRetrievalTool = 'retrieval';
export interface IAssistantWithRetrievalUpdateDTO {
  name?: string;
  model?: string;
  description?: string;
  instructions?: string;
  tools?: [{ type: TRetrievalTool }];
  file_ids?: string[];
  metadata?: Record<string, any>;
}
