import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert } from 'react-native';
import { COLORS } from '../theme';

export default function InvoiceImportScreen({ navigation }) {
  const [invoiceNo, setInvoiceNo] = useState('SL-INV-1092');
  const [orderId, setOrderId] = useState('ORD-99812');
  const [dealerName, setDealerName] = useState('Agro Tech Solutions (Kisan Garage)');
  const [productName, setProductName] = useState('Crop Shield Super 500ml');
  const [quantity, setQuantity] = useState('5');

  const handleSaveInvoice = async () => {
    Alert.alert('Invoice Imported', `Sales Invoice #${invoiceNo} assigned to ${dealerName} (${quantity} boxes)`);
    navigation.navigate('ScanVerify');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Import Sales Invoice (Tally / Excel)</Text>
        <Text style={styles.subtitle}>Import Tally invoice / Excel order to assign dealer</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Invoice Number *</Text>
          <TextInput style={styles.input} value={invoiceNo} onChangeText={setInvoiceNo} />

          <Text style={styles.label}>Order ID</Text>
          <TextInput style={styles.input} value={orderId} onChangeText={setOrderId} />

          <Text style={styles.label}>Dealer & Garage Name *</Text>
          <TextInput style={styles.input} value={dealerName} onChangeText={setDealerName} />

          <Text style={styles.label}>Product Name *</Text>
          <TextInput style={styles.input} value={productName} onChangeText={setProductName} />

          <Text style={styles.label}>Dispatch Quantity (Boxes) *</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={quantity} onChangeText={setQuantity} />

          <TouchableOpacity style={styles.btn} onPress={handleSaveInvoice}>
            <Text style={styles.btnText}>Import & Assign for Dispatch Verification</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20 },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.slate900 },
  subtitle: { fontSize: 12, color: COLORS.slate500, fontWeight: '600', marginBottom: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.slate700, marginTop: 10, marginBottom: 4 },
  input: { backgroundColor: COLORS.slate100, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontWeight: '600' },
  btn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#FFF', fontWeight: '800', fontSize: 13 }
});
