import { Alert } from 'react-native';

export type PickedFile = {
  uri: string;
  name: string;
  type: string;
  fileCopyUri?: string;
};

// For demo purposes, we'll use the asset file
// In a real app, you would integrate with a proper file picker
export async function pickPdfFile(): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    Alert.alert(
      'PDF File Selection',
      'Choose a PDF source for text extraction using iText library:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(null),
        },
        {
          text: 'Sample PDF (set.pdf)',
          onPress: () => resolve({
            uri: 'asset://set.pdf',
            name: 'set.pdf',
            type: 'application/pdf',
          }),
        },
        {
          text: 'Demo: Simulate Upload',
          onPress: () => resolve({
            uri: 'asset://set.pdf',
            name: 'uploaded_document.pdf',
            type: 'application/pdf',
          }),
        },
      ]
    );
  });
}
