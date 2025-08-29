export interface DocumentPickerResult {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

export interface DocumentPickerOptions {
  type?: string[];
  allowMultiSelection?: boolean;
}

declare class DocumentPicker {
  static types: {
    allFiles: string;
    images: string;
    plainText: string;
    audio: string;
    pdf: string;
    zip: string;
    csv: string;
    doc: string;
    docx: string;
    ppt: string;
    pptx: string;
    xls: string;
    xlsx: string;
  };

  static pick(options?: DocumentPickerOptions): Promise<DocumentPickerResult[] | null>;
  static pickSingle(options?: DocumentPickerOptions): Promise<DocumentPickerResult | null>;
}

export default DocumentPicker;
