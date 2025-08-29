import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import DocumentPicker, { DocumentPickerResult } from '../src/components/DocumentPicker';

const DocumentPickerExample = () => {
  const [selectedDocument, setSelectedDocument] = useState<DocumentPickerResult | null>(null);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.doc],
      });

      if (result) {
        setSelectedDocument(result);
        Alert.alert('Success', `Selected: ${result.name}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage !== 'User cancelled') {
        Alert.alert('Error', errorMessage);
      }
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Document Picker Example</Text>
      
      <TouchableOpacity style={styles.button} onPress={pickDocument}>
        <Text style={styles.buttonText}>Pick Document</Text>
      </TouchableOpacity>

      {selectedDocument && (
        <View style={styles.selectedDocument}>
          <Text style={styles.selectedTitle}>Selected Document:</Text>
          <Text style={styles.documentInfo}>Name: {selectedDocument.name}</Text>
          <Text style={styles.documentInfo}>Type: {selectedDocument.type}</Text>
          <Text style={styles.documentInfo}>URI: {selectedDocument.uri}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectedDocument: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  documentInfo: {
    fontSize: 14,
    marginBottom: 5,
    color: '#666',
  },
});

export default DocumentPickerExample;
